"""
Voice Extraction Service
========================
Extracts clean voice reference clips from lecture MP4 files for use as
XTTS-v2 speaker references (voice cloning).

Pipeline per video (smart, per-teacher tuned):
  1. Seek to per-teacher skip_intro_s (bypasses title cards / intro music)
  2. Extract audio buffer with FFmpeg, applying loudnorm to fix gain issues
  3. Run WebRTC VAD with a "minimum sustained run" filter:
       -- rejects isolated voiced frames (music / noise triggers single frames)
       -- only accepts runs of >= MIN_SPEECH_RUN_MS consecutive voiced frames
  4. Concatenate the first TARGET_DURATION_S of sustained voiced speech
  5. Apply a final loudnorm pass on the output WAV for consistent XTTS-v2 input

Why per-teacher overrides?
  Andrew-ML  : starts speaking at ~5s, audio is very quiet (-38 dB mean) -> need loudnorm
  David-C    : 0-75s is a title-card silent gap then loud music; speech starts at ~78s
  Erik-ADSA  : starts at ~2s but audio clips at 0 dB -> need loudnorm / limiting
  Grant-LLM  : clean speech from 0s, no issues

Requirements:
  FFmpeg in PATH (managed by config.py)
  pip install webrtcvad-wheels (Windows pre-built)
"""

from __future__ import annotations

import logging
import subprocess
import tempfile
import wave
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent          # backend/
VIDEOS_DIR = BASE_DIR / "data" / "videos"
VOICES_DIR = BASE_DIR / "data" / "voices"
VOICES_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# Global defaults
# ---------------------------------------------------------------------------
TARGET_DURATION_S: float = 25.0
VAD_SAMPLE_RATE: int = 16000
VAD_FRAME_MS: int = 30
# Minimum consecutive voiced frames before we accept a run as "real speech"
# 300 ms / 30 ms per frame = 10 frames. Music / noise rarely sustains this long
# without a gap, but a human speaker naturally does.
MIN_SPEECH_RUN_FRAMES: int = 10   # = 300 ms

# ---------------------------------------------------------------------------
# Per-teacher extraction configuration
# Tuned from audio analysis results:
#   Andrew-ML  mean=-38dB -> very quiet; speech starts ~5s
#   David-C    0-6s short speech, then 64s gap, then continuous from ~75s
#   Erik-ADSA  peaks at 0dB (clipping); speech starts ~2s
#   Grant-LLM  clean from 0s
# ---------------------------------------------------------------------------
TEACHER_VIDEO_MAP: dict[str, dict] = {
    "Andrew-ML": {
        "voice_id": "andrew-ml",
        "teacher_name": "Andrew",
        "subject": "Machine Learning",
        # Audio is very quiet; start at 8s to skip intro silence.
        # loudnorm brings -38dB mean up to broadcast level.
        "skip_intro_s": 8.0,
        "vad_aggressiveness": 1,         # less aggressive since signal is weak post-norm
        "apply_loudnorm": True,
    },
    "David-C": {
        "voice_id": "david-c",
        "teacher_name": "David",
        "subject": "C Programming",
        # 0-6s has brief sound, then 64s of silence/title-card, speech resumes ~78s.
        # Skip to 78s to land right on the first clear speech segment.
        "skip_intro_s": 78.0,
        "vad_aggressiveness": 2,
        "apply_loudnorm": True,
    },
    "Erik-ADSA": {
        "voice_id": "erik-adsa",
        "teacher_name": "Erik",
        "subject": "Algorithms & Data Structures",
        # Speech starts at ~2s but audio clips at 0dB (overdriven).
        # Start at 22s (past intro section); loudnorm + limiting fixes the clipping.
        "skip_intro_s": 22.0,
        "vad_aggressiveness": 3,         # aggressive to filter out residual distortion
        "apply_loudnorm": True,
    },
    "Grant-LLM": {
        "voice_id": "grant-llm",
        "teacher_name": "Grant",
        "subject": "Large Language Models",
        # Clean speech from the very start, consistent volume.
        "skip_intro_s": 2.0,
        "vad_aggressiveness": 2,
        "apply_loudnorm": False,
    },
}


# ---------------------------------------------------------------------------
# FFmpeg helpers
# ---------------------------------------------------------------------------

def _ffmpeg_extract_normalized(
    video_path: Path,
    out_wav: Path,
    skip_s: float,
    duration_s: float,
    apply_loudnorm: bool,
) -> None:
    """
    Extract audio from video, skipping skip_s seconds at the start,
    grabbing duration_s seconds total. Optionally applies loudnorm
    (EBU R128 loudness normalisation) + a hard limiter to fix both
    quiet and clipping audio.
    """
    if apply_loudnorm:
        # Two-pass loudnorm is most accurate but slow; single-pass is good enough
        # for a speaker reference clip. We also apply a hard limiter at -1 dBFS.
        audio_filter = "loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9:level=disabled"
    else:
        audio_filter = "aresample=16000"  # just resample, no processing

    cmd = [
        "ffmpeg", "-y",
        "-ss", str(skip_s),
        "-i", str(video_path),
        "-vn",
        "-ac", "1",
        "-ar", str(VAD_SAMPLE_RATE),
        "-acodec", "pcm_s16le",
        "-t", str(duration_s),
        "-af", audio_filter,
        str(out_wav),
    ]
    result = subprocess.run(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        timeout=300,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"FFmpeg failed: {result.stderr.decode(errors='replace')[-600:]}"
        )


# ---------------------------------------------------------------------------
# WAV I/O
# ---------------------------------------------------------------------------

def _read_wave(path: Path):
    """Return (pcm_bytes, sample_rate) from a 16-bit mono WAV."""
    with wave.open(str(path), "rb") as wf:
        sample_rate = wf.getframerate()
        num_frames = wf.getnframes()
        pcm = wf.readframes(num_frames)
    return pcm, sample_rate


def _write_wave(path: Path, pcm: bytes, sample_rate: int) -> None:
    """Write raw 16-bit PCM bytes to a WAV file."""
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm)


# ---------------------------------------------------------------------------
# VAD — sustained-speech filter
# ---------------------------------------------------------------------------

def _import_vad():
    """Import webrtcvad or webrtcvad_wheels (Windows fallback)."""
    try:
        import webrtcvad
        return webrtcvad
    except ImportError:
        pass
    try:
        import webrtcvad_wheels as webrtcvad  # type: ignore
        return webrtcvad
    except ImportError:
        return None


def _vad_extract_sustained_speech(
    pcm: bytes,
    sample_rate: int,
    aggressiveness: int,
    frame_ms: int,
    target_s: float,
    min_run_frames: int,
) -> Optional[bytes]:
    """
    Extract the first `target_s` seconds of *sustained* voiced speech.

    Unlike a naive voiced-frame collector, this requires at least
    `min_run_frames` consecutive voiced frames before accepting a run.
    This filters out music / noise bursts that trigger VAD in isolated frames
    while letting through real continuous human speech.

    Returns None if webrtcvad is unavailable.
    """
    webrtcvad = _import_vad()
    if webrtcvad is None:
        logger.warning("webrtcvad not available -- falling back to loudnorm-only extraction")
        return None

    vad = webrtcvad.Vad(aggressiveness)
    frame_length = int(sample_rate * frame_ms / 1000)
    frame_bytes = frame_length * 2

    target_samples = int(target_s * sample_rate)
    accepted_chunks: list[bytes] = []
    total_accepted_samples = 0

    # --- Sliding buffer for run detection ---
    run_buffer: list[bytes] = []   # candidate voiced frames not yet committed

    offset = 0
    while offset + frame_bytes <= len(pcm):
        frame = pcm[offset: offset + frame_bytes]
        offset += frame_bytes

        try:
            is_speech = vad.is_speech(frame, sample_rate)
        except Exception:
            is_speech = False

        if is_speech:
            run_buffer.append(frame)
        else:
            if len(run_buffer) >= min_run_frames:
                # Commit this run — it's long enough to be real speech
                for chunk in run_buffer:
                    accepted_chunks.append(chunk)
                    total_accepted_samples += frame_length
                    if total_accepted_samples >= target_samples:
                        break
            # Reset run regardless
            run_buffer = []

        if total_accepted_samples >= target_samples:
            break

    # Handle a run that was still in progress at end of audio
    if total_accepted_samples < target_samples and len(run_buffer) >= min_run_frames:
        for chunk in run_buffer:
            accepted_chunks.append(chunk)
            total_accepted_samples += frame_length
            if total_accepted_samples >= target_samples:
                break

    if not accepted_chunks:
        logger.warning("Sustained-speech VAD found no qualifying runs -- will use trimmed audio")
        return None

    actual_s = total_accepted_samples / sample_rate
    logger.info(
        "VAD: accepted %.1f s of sustained speech (runs >= %d frames / %d ms)",
        actual_s, min_run_frames, min_run_frames * frame_ms,
    )
    return b"".join(accepted_chunks)


# ---------------------------------------------------------------------------
# Final loudnorm pass on output WAV
# ---------------------------------------------------------------------------

def _normalize_wav_inplace(wav_path: Path) -> None:
    """Run loudnorm on an existing WAV file, replacing it in place."""
    tmp = wav_path.with_suffix(".tmp.wav")
    cmd = [
        "ffmpeg", "-y",
        "-i", str(wav_path),
        "-af", "loudnorm=I=-16:TP=-1.5:LRA=11,alimiter=limit=0.9:level=disabled",
        "-ar", str(VAD_SAMPLE_RATE),
        "-ac", "1",
        "-acodec", "pcm_s16le",
        str(tmp),
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=60)
    if result.returncode == 0:
        tmp.replace(wav_path)
    else:
        if tmp.exists():
            tmp.unlink()


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_voice_reference(
    video_path: Path,
    voice_id: str,
    teacher_cfg: dict,
    target_duration_s: float = TARGET_DURATION_S,
) -> Path:
    """
    Extract a clean, normalized voice reference WAV from a lecture video.

    Parameters
    ----------
    video_path      : Path to the .mp4 file.
    voice_id        : Output filename stem (saved to data/voices/{voice_id}.wav).
    teacher_cfg     : Per-teacher config dict from TEACHER_VIDEO_MAP.
    target_duration_s : Desired voiced speech duration in seconds.

    Returns
    -------
    Path to the saved WAV in data/voices/.
    """
    out_path = VOICES_DIR / f"{voice_id}.wav"
    if out_path.exists():
        logger.info("Voice reference already exists: %s -- skipping", out_path.name)
        return out_path

    skip_s = teacher_cfg.get("skip_intro_s", 5.0)
    vad_agg = teacher_cfg.get("vad_aggressiveness", 2)
    apply_loudnorm = teacher_cfg.get("apply_loudnorm", True)

    logger.info(
        "=== Extracting voice for '%s' | skip=%.0fs | VAD=%d | loudnorm=%s ===",
        voice_id, skip_s, vad_agg, apply_loudnorm,
    )

    with tempfile.TemporaryDirectory(prefix="tc_voice_") as tmpdir:
        tmp = Path(tmpdir)
        full_wav = tmp / "full.wav"

        # Buffer 3x target + 20s extra to account for pauses
        buffer_s = target_duration_s * 3 + 20
        logger.info("FFmpeg: extracting %.0fs buffer from t=%.0fs (with loudnorm=%s)...",
                    buffer_s, skip_s, apply_loudnorm)

        _ffmpeg_extract_normalized(
            video_path=video_path,
            out_wav=full_wav,
            skip_s=skip_s,
            duration_s=buffer_s,
            apply_loudnorm=apply_loudnorm,
        )

        pcm, sample_rate = _read_wave(full_wav)
        actual_buf_s = len(pcm) / 2 / sample_rate
        logger.info("Buffer loaded: %.1f s @ %d Hz", actual_buf_s, sample_rate)

        # Run sustained-speech VAD
        voiced_pcm = _vad_extract_sustained_speech(
            pcm=pcm,
            sample_rate=sample_rate,
            aggressiveness=vad_agg,
            frame_ms=VAD_FRAME_MS,
            target_s=target_duration_s,
            min_run_frames=MIN_SPEECH_RUN_FRAMES,
        )

        if voiced_pcm:
            _write_wave(out_path, voiced_pcm, sample_rate)
        else:
            # VAD fallback: just trim the loudnorm-processed audio
            logger.warning("VAD fallback: using first %.0fs of loudnorm-processed buffer", target_duration_s)
            trim_pcm = pcm[: int(target_duration_s * sample_rate) * 2]
            _write_wave(out_path, trim_pcm, sample_rate)

        # Final loudnorm pass on the voice reference WAV (ensures XTTS-v2 gets
        # consistent input regardless of which path we took above)
        logger.info("Applying final loudnorm pass on output WAV...")
        _normalize_wav_inplace(out_path)

    size_kb = out_path.stat().st_size / 1024
    logger.info("[OK] Voice reference saved: %s (%.0f KB)", out_path.name, size_kb)
    return out_path


def process_all_videos(
    videos_dir: Path = VIDEOS_DIR,
    target_duration_s: float = TARGET_DURATION_S,
) -> dict[str, Path]:
    """
    Process every video in VIDEOS_DIR according to TEACHER_VIDEO_MAP.
    Returns a dict mapping voice_id -> output WAV path.
    """
    results: dict[str, Path] = {}
    video_files = {p.stem: p for p in videos_dir.glob("*.mp4")}

    if not video_files:
        logger.warning("No .mp4 files found in %s", videos_dir)
        return results

    logger.info("Found %d video(s) in %s", len(video_files), videos_dir)

    for stem, info in TEACHER_VIDEO_MAP.items():
        if stem not in video_files:
            logger.warning("Video '%s.mp4' not found -- skipping", stem)
            continue

        video_path = video_files[stem]
        voice_id = info["voice_id"]

        try:
            out = extract_voice_reference(
                video_path=video_path,
                voice_id=voice_id,
                teacher_cfg=info,
                target_duration_s=target_duration_s,
            )
            results[voice_id] = out
        except Exception as exc:
            logger.error("Failed to extract voice for '%s': %s", voice_id, exc, exc_info=True)

    return results
