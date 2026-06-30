"""
ingest_lecture_transcripts.py
=============================
CLI script — run from the backend/ directory AFTER transcribe_lectures.py:

    python scripts/ingest_lecture_transcripts.py

What it does:
  1. Reads each *_transcript.txt from data/transcripts/
  2. Splits the transcript into ~500-token chunks
  3. Embeds each chunk with Ollama nomic-embed-text
  4. Stores chunks in ChromaDB under the correct subject_id collection
  5. Logs each document in the Supabase public.documents table

After this, students chatting with a teacher clone will have the full
lecture content available as RAG context.
"""

from __future__ import annotations

import json
import logging
import sys
import uuid
from datetime import datetime
from pathlib import Path

# ── Ensure backend/ is in sys.path ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa: F401

from services.voice_extraction_service import TEACHER_VIDEO_MAP

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

TRANSCRIPTS_DIR = BACKEND_DIR / "data" / "transcripts"

BANNER = """
╔══════════════════════════════════════════════════════════╗
║    TeacherClone — Lecture Transcript Ingestion (RAG)     ║
╚══════════════════════════════════════════════════════════╝
"""

# Subject mapping from voice_id → subject_id in Supabase
VOICE_TO_SUBJECT: dict[str, str] = {
    "andrew-ml":  "ml",
    "david-c":    "prog",
    "erik-adsa":  "ds",
    "grant-llm":  "ml",   # Grant teaches LLMs — maps to ML subject
}


def _chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping word-level chunks.
    chunk_size : approximate words per chunk
    overlap    : words of overlap between consecutive chunks
    """
    words = text.split()
    chunks: list[str] = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        chunks.append(chunk)
        if end == len(words):
            break
        start += chunk_size - overlap
    return chunks


def _get_embedding(text: str) -> list[float]:
    """Generate a dense embedding vector for text using Ollama's local API."""
    import httpx
    from config import settings
    url = f"{settings.OLLAMA_BASE_URL}/api/embeddings"
    payload = {
        "model": settings.OLLAMA_EMBED_MODEL,
        "prompt": text,
    }
    with httpx.Client(timeout=60.0) as client:
        response = client.post(url, json=payload)
        response.raise_for_status()
    return response.json()["embedding"]


def ingest_transcript(
    transcript_path: Path,
    voice_id: str,
    subject_id: str,
    teacher_name: str,
    subject: str,
) -> int:
    """
    Ingest a single transcript into ChromaDB.
    Returns the number of chunks ingested.
    """
    from services.vector_service import vector_service

    text = transcript_path.read_text(encoding="utf-8")
    if not text.strip():
        logger.warning("Transcript is empty: %s", transcript_path.name)
        return 0

    chunks = _chunk_text(text, chunk_size=450, overlap=50)
    logger.info(
        "Ingesting '%s' (%s) — %d chunks for subject '%s'",
        teacher_name, subject, len(chunks), subject_id,
    )

    chunk_ids = []
    embeddings = []
    metadatas = []

    for i, chunk in enumerate(chunks):
        try:
            emb = _get_embedding(chunk)
            embeddings.append(emb)
            chunk_ids.append(f"{voice_id}-chunk-{i}")
            metadatas.append({
                "source": transcript_path.name,
                "teacher": teacher_name,
                "subject": subject,
                "voice_id": voice_id,
                "chunk_index": i,
                "subject_id": subject_id,  # CRITICAL for filtering by subject in query_similar
            })
        except Exception as exc:
            logger.error("Failed to generate embedding for chunk %d: %s", i, exc)
            return 0

    vector_service.add_documents(
        chunks=chunks,
        ids=chunk_ids,
        embeddings=embeddings,
        metadatas=metadatas,
    )

    logger.info("✓ Ingested %d chunks for '%s'", len(chunks), voice_id)
    return len(chunks)


def _seed_documents_table(voice_id: str, filename: str, chunk_count: int, subject_id: str) -> None:
    """Record the ingested document in Supabase public.documents."""
    try:
        from config import supabase
        if supabase is None:
            return
        supabase.table("documents").upsert({
            "file_id": str(uuid.uuid5(uuid.NAMESPACE_DNS, voice_id)),
            "filename": filename,
            "chunk_count": chunk_count,
            "timestamp": datetime.utcnow().isoformat(),
            "status": "ingested",
            "subject_id": subject_id,
        }).execute()
        logger.info("Supabase: recorded document '%s'", filename)
    except Exception as exc:
        logger.warning("Supabase documents seed failed (non-fatal): %s", exc)


def main() -> int:
    print(BANNER)

    # ── Find available transcripts ────────────────────────────────────────────
    transcript_files = {p.stem.replace("_transcript", ""): p
                        for p in TRANSCRIPTS_DIR.glob("*_transcript.txt")}

    if not transcript_files:
        logger.error(
            "No transcripts found in %s. Run transcribe_lectures.py first.", TRANSCRIPTS_DIR
        )
        return 1

    logger.info("Found %d transcript(s):", len(transcript_files))
    for k, p in transcript_files.items():
        logger.info("  %-20s  %s", k, p.name)
    print()

    total_chunks = 0
    processed = 0

    for stem, info in TEACHER_VIDEO_MAP.items():
        voice_id = info["voice_id"]
        if voice_id not in transcript_files:
            logger.warning("No transcript for '%s' — skipping", voice_id)
            continue

        transcript_path = transcript_files[voice_id]
        subject_id = VOICE_TO_SUBJECT.get(voice_id, "prog")

        chunk_count = ingest_transcript(
            transcript_path=transcript_path,
            voice_id=voice_id,
            subject_id=subject_id,
            teacher_name=info["teacher_name"],
            subject=info["subject"],
        )

        if chunk_count > 0:
            _seed_documents_table(
                voice_id=voice_id,
                filename=transcript_path.name,
                chunk_count=chunk_count,
                subject_id=subject_id,
            )
            total_chunks += chunk_count
            processed += 1

    # ── Summary ───────────────────────────────────────────────────────────────
    print()
    print("─" * 60)
    print(f"  Ingested {processed} transcript(s), {total_chunks} total chunks.")
    print("─" * 60)
    print()
    print("RAG is now active! Students can ask questions and the AI teacher")
    print("will answer using lecture content as context.")

    return 0 if processed > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
