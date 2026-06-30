"""
extract_teacher_voices.py
=========================
CLI script — run from the backend/ directory:

    python scripts/extract_teacher_voices.py

What it does:
  1. Reads every .mp4 in data/videos/
  2. Extracts a clean 25-second voice reference WAV for each teacher
  3. Saves to data/voices/{voice_id}.wav
  4. Updates the Supabase public.voices table with new entries
  5. Prints a summary table of results

Safe to re-run — already-extracted voices are skipped.
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

# ── Ensure the backend/ directory is in sys.path ─────────────────────────────
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# ── Trigger FFmpeg PATH injection from config.py ──────────────────────────────
import config  # noqa: F401  (side effect: adds FFmpeg to PATH)

from services.voice_extraction_service import (
    TEACHER_VIDEO_MAP,
    VOICES_DIR,
    VIDEOS_DIR,
    process_all_videos,
)

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

BANNER = """
+----------------------------------------------------------+
|         TeacherClone - Voice Extraction Pipeline         |
+----------------------------------------------------------+
"""


def _seed_voices_table(voice_entries: list[dict]) -> None:
    """Insert voice metadata into Supabase public.voices (best-effort)."""
    try:
        from config import supabase
        if supabase is None:
            logger.warning("Supabase client not available — skipping DB seed.")
            return
        supabase.table("voices").upsert(voice_entries).execute()
        logger.info("Supabase: upserted %d voice record(s).", len(voice_entries))
    except Exception as exc:
        logger.warning("Supabase voice seed failed (non-fatal): %s", exc)


def main() -> int:
    print(BANNER)

    # ── Preflight checks ──────────────────────────────────────────────────────
    if not VIDEOS_DIR.exists():
        logger.error("Videos directory not found: %s", VIDEOS_DIR)
        return 1

    mp4_files = list(VIDEOS_DIR.glob("*.mp4"))
    if not mp4_files:
        logger.error("No .mp4 files found in %s", VIDEOS_DIR)
        return 1

    logger.info("Found %d video(s):", len(mp4_files))
    for f in mp4_files:
        size_mb = f.stat().st_size / 1024 / 1024
        logger.info("  %-30s  %6.1f MB", f.name, size_mb)

    print()

    # ── Run extraction ────────────────────────────────────────────────────────
    logger.info("Starting voice extraction...")  
    results = process_all_videos(VIDEOS_DIR)

    print()

    # ── Summary ───────────────────────────────────────────────────────────────
    print("=" * 60)
    print(f"  {'Teacher':<12}  {'Subject':<30}  {'Voice ID':<15}  Status")
    print("=" * 60)

    voice_db_entries: list[dict] = []
    success_count = 0

    for stem, info in TEACHER_VIDEO_MAP.items():
        vid = info["voice_id"]
        wav = VOICES_DIR / f"{vid}.wav"
        status = "[OK]" if wav.exists() else "[FAILED]"
        if wav.exists():
            size_kb = wav.stat().st_size / 1024
            status = f"[OK]  ({size_kb:.0f} KB)"
            success_count += 1
            voice_db_entries.append({"id": vid, "filename": f"{vid}.wav"})
        print(f"  {info['teacher_name']:<12}  {info['subject']:<30}  {vid:<15}  {status}")

    print("-" * 60)
    print(f"  {success_count}/{len(TEACHER_VIDEO_MAP)} voices extracted successfully.")
    print()

    # -- Seed Supabase
    if voice_db_entries:
        logger.info("Seeding Supabase public.voices table...")
        _seed_voices_table(voice_db_entries)

    return 0 if success_count > 0 else 1


if __name__ == "__main__":
    sys.exit(main())
