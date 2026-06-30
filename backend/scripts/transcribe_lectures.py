"""
transcribe_lectures.py
======================
CLI script — run from the backend/ directory:

    python scripts/transcribe_lectures.py

What it does:
  1. Uses OpenAI Whisper (local, no API key needed) to transcribe each lecture
  2. Saves full transcript to data/documents/{voice_id}_transcript.txt
  3. Sends transcript to local Ollama llama3 to extract:
     - Teaching style features
     - Vocabulary level
     - Personality prompt (injected into chat system prompt)
  4. Prints extracted personality prompts so you can review/edit
  5. Optionally updates teacher_service.py TEACHER_CLONES with the prompts

Usage:
    python scripts/transcribe_lectures.py                    # transcribe all
    python scripts/transcribe_lectures.py --teacher andrew   # single teacher
    python scripts/transcribe_lectures.py --model medium     # whisper model size

Whisper model sizes (speed vs accuracy trade-off):
    tiny   ~1 GB  — fastest, lower accuracy
    base   ~1 GB  — good balance for English
    small  ~2 GB  — recommended for technical content
    medium ~5 GB  — high accuracy, slower (default here)
    large  ~10 GB — best accuracy, requires more VRAM
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
import time
from pathlib import Path

# ── Ensure backend/ is in sys.path ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa: F401  (side effect: FFmpeg PATH injection)

from services.voice_extraction_service import TEACHER_VIDEO_MAP, VIDEOS_DIR

# ── Paths ─────────────────────────────────────────────────────────────────────
TRANSCRIPTS_DIR = BACKEND_DIR / "data" / "transcripts"
TRANSCRIPTS_DIR.mkdir(parents=True, exist_ok=True)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BANNER = """
╔══════════════════════════════════════════════════════════╗
║       TeacherClone — Lecture Transcription Pipeline      ║
╚══════════════════════════════════════════════════════════╝
"""

# ── Personality extraction prompt template ────────────────────────────────────
PERSONALITY_EXTRACTION_PROMPT = """You are an AI assistant that analyses lecture transcripts to understand a teacher's style.

Below is a transcript excerpt from a {teacher_name}'s lecture on {subject}.

TRANSCRIPT:
\"\"\"
{transcript_excerpt}
\"\"\"

Based on this transcript, write a system prompt (200–300 words) that will make an AI assistant sound and teach like this teacher.
The prompt must describe:
1. Teaching style (step-by-step, conceptual, example-driven, etc.)
2. Vocabulary level and tone (formal/casual, technical depth)
3. How they structure explanations (do they use analogies? proofs? code examples?)
4. Characteristic phrases or habits you noticed
5. How they engage with students

Respond with ONLY the system prompt text. No explanation, no labels, no markdown.
Start with: "You are {teacher_name}, a {subject} instructor..."
"""


def transcribe_video(video_path: Path, whisper_model_size: str = "medium") -> str:
    """
    Transcribe a video file using OpenAI Whisper (local).
    Returns the full transcript as a string.
    """
    try:
        import whisper
    except ImportError:
        raise ImportError(
            "openai-whisper is not installed. Run: pip install openai-whisper"
        )

    logger.info("Loading Whisper model '%s'…", whisper_model_size)
    import torch
    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("Using device: %s", device)
    model = whisper.load_model(whisper_model_size, device=device)

    logger.info("Transcribing %s (this may take several minutes)…", video_path.name)
    t0 = time.time()
    result = model.transcribe(
        str(video_path),
        language="en",
        verbose=False,
        fp16=(device == "cuda"),  # GPU-safe FP16 on CUDA only (disable on MPS/CPU)
    )
    elapsed = time.time() - t0
    logger.info("Transcription complete in %.1f s", elapsed)

    return result["text"]


def extract_personality_with_ollama(
    transcript: str,
    teacher_name: str,
    subject: str,
    ollama_model: str | None = None,
    excerpt_chars: int = 8000,
) -> str:
    """
    Send a transcript excerpt to Ollama to generate a personality_prompt.
    Falls back to a templated default if Ollama is not available.
    """
    try:
        import httpx
    except ImportError:
        logger.warning("httpx not installed — using default personality prompt")
        return _default_personality_prompt(teacher_name, subject)

    # Use the middle portion of the transcript (skip intro/outro)
    mid = len(transcript) // 4
    excerpt = transcript[mid: mid + excerpt_chars]

    prompt = PERSONALITY_EXTRACTION_PROMPT.format(
        teacher_name=teacher_name,
        subject=subject,
        transcript_excerpt=excerpt,
    )

    try:
        from config import settings
        if ollama_model is None:
            ollama_model = settings.OLLAMA_MODEL
        ollama_url = f"{settings.OLLAMA_BASE_URL}/api/generate"
        logger.info("Calling Ollama %s to extract personality…", ollama_model)

        response = httpx.post(
            ollama_url,
            json={"model": ollama_model, "prompt": prompt, "stream": False},
            timeout=120.0,
        )
        response.raise_for_status()
        data = response.json()
        personality = data.get("response", "").strip()
        if personality:
            return personality
    except Exception as exc:
        logger.warning("Ollama personality extraction failed: %s", exc)

    return _default_personality_prompt(teacher_name, subject)


def _default_personality_prompt(teacher_name: str, subject: str) -> str:
    """Fallback personality prompt when Ollama is unavailable."""
    return (
        f"You are {teacher_name}, an expert {subject} instructor. "
        f"You teach with clarity and precision, using real-world examples "
        f"and step-by-step breakdowns. Your tone is engaging and encouraging. "
        f"You always check for student understanding before moving on and "
        f"welcome questions at any point."
    )


def process_teacher(
    stem: str,
    info: dict,
    whisper_model: str,
    force: bool = False,
) -> dict:
    """
    Transcribe one teacher's lecture video and extract their personality profile.
    Returns a result dict with transcript path and personality prompt.
    """
    voice_id = info["voice_id"]
    teacher_name = info["teacher_name"]
    subject = info["subject"]

    video_files = {p.stem: p for p in VIDEOS_DIR.glob("*.mp4")}
    if stem not in video_files:
        logger.warning("Video '%s.mp4' not found — skipping", stem)
        return {}

    video_path = video_files[stem]
    transcript_path = TRANSCRIPTS_DIR / f"{voice_id}_transcript.txt"
    profile_path = TRANSCRIPTS_DIR / f"{voice_id}_profile.json"

    # ── Check if already done ─────────────────────────────────────────────────
    if transcript_path.exists() and profile_path.exists() and not force:
        logger.info("'%s' already transcribed — loading cached profile", voice_id)
        with open(profile_path) as f:
            return json.load(f)

    # ── Transcribe ────────────────────────────────────────────────────────────
    transcript = transcribe_video(video_path, whisper_model_size=whisper_model)
    transcript_path.write_text(transcript, encoding="utf-8")
    logger.info("Transcript saved: %s (%d chars)", transcript_path.name, len(transcript))

    # ── Extract personality ───────────────────────────────────────────────────
    personality_prompt = extract_personality_with_ollama(
        transcript, teacher_name, subject
    )

    profile = {
        "voice_id": voice_id,
        "teacher_name": teacher_name,
        "subject": subject,
        "transcript_path": str(transcript_path),
        "transcript_chars": len(transcript),
        "personality_prompt": personality_prompt,
    }
    with open(profile_path, "w") as f:
        json.dump(profile, f, indent=2)

    logger.info("Profile saved: %s", profile_path.name)
    return profile


def main() -> int:
    print(BANNER)

    # ── CLI args ──────────────────────────────────────────────────────────────
    parser = argparse.ArgumentParser(description="Transcribe teacher lecture videos")
    parser.add_argument(
        "--teacher",
        help="Stem name of a single teacher to process (e.g. 'andrew'). Omit to process all.",
        default=None,
    )
    parser.add_argument(
        "--model",
        help="Whisper model size: tiny|base|small|medium|large (default: medium)",
        default="medium",
    )
    parser.add_argument(
        "--force",
        help="Re-transcribe even if cached transcript exists",
        action="store_true",
    )
    args = parser.parse_args()

    # ── Filter teachers ───────────────────────────────────────────────────────
    teachers_to_process = TEACHER_VIDEO_MAP
    if args.teacher:
        teachers_to_process = {
            k: v for k, v in TEACHER_VIDEO_MAP.items()
            if v["teacher_name"].lower() == args.teacher.lower()
        }
        if not teachers_to_process:
            logger.error("Unknown teacher '%s'. Available: %s",
                         args.teacher,
                         ", ".join(v["teacher_name"] for v in TEACHER_VIDEO_MAP.values()))
            return 1

    logger.info("Processing %d teacher(s) with Whisper '%s' model…",
                len(teachers_to_process), args.model)
    print()

    profiles: list[dict] = []
    for stem, info in teachers_to_process.items():
        logger.info("--- %s (%s) ---", info["teacher_name"], info["subject"])
        profile = process_teacher(stem, info, whisper_model=args.model, force=args.force)
        if profile:
            profiles.append(profile)
        print()

    # ── Print generated personality prompts ───────────────────────────────────
    if profiles:
        print("=" * 70)
        print("  GENERATED PERSONALITY PROMPTS")
        print("  Review these and add them to teacher_service.py TEACHER_CLONES")
        print("=" * 70)
        for p in profiles:
            print(f"\n[{p['teacher_name']} — {p['subject']}]")
            print(f"voice_id: {p['voice_id']}")
            print(f"personality_prompt:\n{p['personality_prompt']}")
            print()

        print("─" * 70)
        print(f"Profiles saved to: {TRANSCRIPTS_DIR}")
        print()
        print("Next step: Run scripts/ingest_lecture_transcripts.py to add")
        print("lecture content to ChromaDB for RAG.")

    return 0 if profiles else 1


if __name__ == "__main__":
    sys.exit(main())
