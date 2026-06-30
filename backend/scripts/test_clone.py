"""
test_clone.py
=============
End-to-end voice cloning test using XTTS-v2.

Run from backend/:
    python scripts/test_clone.py

Generates one 2-sentence sample in each teacher's cloned voice.
Output files: data/audio/clone_test_{voice_id}.wav

On GPU (RTX 3050):  ~5-10s per clip
On CPU:             ~3-5 min per clip
"""

from __future__ import annotations

import logging
import os
import sys
import time
from pathlib import Path

# UTF-8 output for Windows
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))
os.chdir(BACKEND_DIR)

import config  # noqa: F401 - FFmpeg PATH injection

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# One test sentence per teacher (short but representative of their style)
# ---------------------------------------------------------------------------
CLONE_TESTS = {
    "andrew-ml": (
        "Hello everyone! Today we're going to build an intuition for gradient descent "
        "before we touch a single equation. Think of it like rolling a ball downhill "
        "to find the lowest point in a valley."
    ),
    "david-c": (
        "Let's look at what the compiler actually does here. When you declare an int pointer, "
        "you're telling the machine to store a memory address, not a value. "
        "What does that mean for stack versus heap allocation?"
    ),
    "erik-adsa": (
        "Before we write any code, let's identify the pattern. This looks like a classic "
        "sliding window problem. What's our brute force first, and where is the bottleneck "
        "we need to eliminate?"
    ),
    "grant-llm": (
        "This is still an open research question, but here's what the Attention Is All You Need "
        "paper actually says versus what most people think it says. "
        "The key insight is in how queries, keys, and values interact."
    ),
}

VOICES_DIR = BACKEND_DIR / "data" / "voices"
AUDIO_DIR  = BACKEND_DIR / "data" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)


def load_xtts():
    """Load XTTS-v2 onto the best available device."""
    import torch
    from TTS.api import TTS as CoquiTTS

    device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
    if device == "mps":
        logger.info("Apple Silicon GPU (MPS) detected -- Loading XTTS-v2 on MPS...")
    elif device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        vram_gb  = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
        logger.info("GPU: %s  |  VRAM: %.1f GB  |  Loading XTTS-v2 on CUDA...", gpu_name, vram_gb)
    else:
        logger.info("No GPU detected -- running on CPU (expect ~3-5 min per clip)")

    t0 = time.time()
    model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    logger.info("XTTS-v2 loaded in %.1f s on %s", time.time() - t0, device.upper())
    return model, device


def clone_voice(model, voice_id: str, text: str) -> Path:
    """Run XTTS-v2 inference with the teacher's voice reference."""
    speaker_wav = VOICES_DIR / f"{voice_id}.wav"
    if not speaker_wav.exists():
        raise FileNotFoundError(
            f"Voice reference not found: {speaker_wav}\n"
            f"Run scripts/extract_teacher_voices.py first."
        )

    out_path = AUDIO_DIR / f"clone_test_{voice_id}.wav"

    logger.info("Cloning '%s' -> %s", voice_id, out_path.name)
    t0 = time.time()
    model.tts_to_file(
        text=text,
        speaker_wav=str(speaker_wav),
        language="en",
        file_path=str(out_path),
    )
    elapsed = time.time() - t0
    size_kb = out_path.stat().st_size / 1024
    logger.info("[OK] %-15s  %.1f s  ->  %.0f KB  ->  %s", voice_id, elapsed, size_kb, out_path.name)
    return out_path


def main() -> int:
    print()
    print("+----------------------------------------------------------+")
    print("|       TeacherClone - Voice Cloning Test (XTTS-v2)        |")
    print("+----------------------------------------------------------+")
    print()

    # Load model once
    try:
        model, device = load_xtts()
    except Exception as e:
        logger.error("Failed to load XTTS-v2: %s", e)
        return 1

    print()
    results = {}
    total_t0 = time.time()

    for voice_id, text in CLONE_TESTS.items():
        logger.info("--- Testing voice: %s ---", voice_id)
        logger.info("Text: %s", text[:80] + "..." if len(text) > 80 else text)
        try:
            out = clone_voice(model, voice_id, text)
            results[voice_id] = ("OK", out)
        except Exception as e:
            logger.error("FAILED for '%s': %s", voice_id, e)
            results[voice_id] = ("FAILED", str(e))
        print()

    # Summary
    total_elapsed = time.time() - total_t0
    print("=" * 65)
    print(f"  Cloning complete in {total_elapsed:.0f}s on {device.upper()}")
    print("=" * 65)
    for voice_id, (status, out) in results.items():
        if status == "OK":
            path = Path(out)
            size_kb = path.stat().st_size / 1024
            print(f"  [OK]     {voice_id:<15}  {size_kb:.0f} KB  ->  {path.name}")
        else:
            print(f"  [FAILED] {voice_id:<15}  {out}")
    print("=" * 65)
    print()
    print(f"Output files in: {AUDIO_DIR}")
    print("Open them in any audio player to compare the cloned voices.")

    ok_count = sum(1 for s, _ in results.values() if s == "OK")
    return 0 if ok_count == len(CLONE_TESTS) else 1


if __name__ == "__main__":
    sys.exit(main())
