"""
ingest_local_documents.py
==========================
CLI script — run from the backend/ directory:

    python scripts/ingest_local_documents.py

What it does:
  1. Scans the backend/data/documents/ directory.
  2. Subdirectories in data/documents/ are treated as subject_ids (e.g. math, physics, prog).
  3. Finds all files in these subdirectories (.pdf, .pptx, .ppt, .txt, .md).
  4. For any file not yet logged in Supabase public.documents, reads its content and ingests it.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# ── Ensure backend/ is in sys.path ────────────────────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa: F401
from services.ingest_service import ingest_service
from services.teacher_service import teacher_service
from config import supabase

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

DOCS_DIR = BACKEND_DIR / "data" / "documents"

def main() -> int:
    if not DOCS_DIR.exists():
        logger.error(f"Documents directory {DOCS_DIR} does not exist.")
        return 1

    # 1. Fetch valid subjects
    try:
        subjects = teacher_service.get_subjects()
        subject_ids = {s["id"] for s in subjects}
    except Exception as e:
        logger.error(f"Failed to fetch subjects: {e}")
        return 1

    # 2. Get already ingested filenames
    ingested_files = set()
    if supabase is not None:
        try:
            response = supabase.table("documents").select("filename").execute()
            if response.data:
                ingested_files = {row["filename"] for row in response.data}
        except Exception as e:
            logger.warning(f"Could not fetch ingested files from Supabase (continuing): {e}")

    logger.info(f"Scanning {DOCS_DIR} for subject folders...")
    
    # 3. Scan subdirectories
    processed_count = 0
    error_count = 0
    
    # Check each item in DOCS_DIR
    for item in DOCS_DIR.iterdir():
        if not item.is_dir():
            continue
            
        subject_id = item.name
        if subject_id not in subject_ids:
            logger.warning(f"Folder '{subject_id}' is not a registered subject ID. Skipping.")
            continue
            
        logger.info(f"Scanning folder for subject '{subject_id}'...")
        
        # Check files inside subject folder
        for file_path in item.iterdir():
            if not file_path.is_file():
                continue
                
            filename = file_path.name
            
            # Skip hidden files
            if filename.startswith('.'):
                continue
                
            ext = file_path.suffix.lower()
            if ext not in {".pdf", ".pptx", ".ppt", ".txt", ".md"}:
                continue
                
            if filename in ingested_files:
                logger.info(f"  [Skipped] '{filename}' is already ingested.")
                continue
                
            logger.info(f"  [Ingesting] '{filename}' into subject '{subject_id}'...")
            
            try:
                # Read bytes
                file_bytes = file_path.read_bytes()
                
                # Ingest file (this will parse, chunk, embed, store in Chroma, and sync to Supabase)
                res = ingest_service.process_file(
                    filename=filename,
                    file_bytes=file_bytes,
                    subject_id=subject_id
                )
                
                if res.get("file_id"):
                    logger.info(f"  ✓ Successfully ingested '{filename}' (File ID: {res['file_id']})")
                    processed_count += 1
                else:
                    logger.error(f"  ✗ Failed to ingest '{filename}': {res.get('detail', 'Unknown error')}")
                    error_count += 1
            except Exception as e:
                logger.error(f"  ✗ Exception while ingesting '{filename}': {e}")
                error_count += 1

    logger.info(f"Batch ingestion complete. Ingested: {processed_count}, Errors: {error_count}")
    return 0

if __name__ == "__main__":
    sys.exit(main())
