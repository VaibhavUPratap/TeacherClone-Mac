from __future__ import annotations
"""
TTS Service — Coqui XTTS-v2 (local, no external API).

Design principles:
  * Model is loaded ONCE at module import time (global singleton).
  * Inference is CPU/GPU-bound; it is offloaded to a ThreadPoolExecutor
    so the FastAPI async event loop is never blocked.
  * Voice files are looked up by voice_id (maps to data/voices/{voice_id}.wav).
  * Audio output is written to data/audio/{uuid}.wav.
  * Future-ready: easily supports multiple voices, languages, and caching.
"""

import asyncio
import logging
import os
import re
import subprocess
import uuid
import wave
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import torch

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths (relative to this file's location: backend/services/tts_service.py)
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent  # Points to 'backend/'
VOICES_DIR = BASE_DIR / "data" / "voices"
AUDIO_DIR = BASE_DIR / "data" / "audio"
AUDIO_DIR.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# XTTS-v2 text limit — the model handles ~400 tokens comfortably.
# We cap at 1 000 characters to avoid very long inference times.
# Increase this if your hardware supports it.
# ---------------------------------------------------------------------------
MAX_CHARS = 1000

# ---------------------------------------------------------------------------
# Load model ONCE -- happens when the module is first imported (at startup).
# On macOS, we skip loading XTTS-v2 to save startup time and VRAM, using
# native macOS speech synthesis instead.
# ---------------------------------------------------------------------------
import sys
IS_MACOS = sys.platform == "darwin"
_device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")

_tts_model = None
if IS_MACOS:
    logger.info("TTS: Native macOS detected. Using Apple native speech synthesis (say command).")
else:
    if _device == "mps":
        logger.info("TTS: Apple Silicon GPU (MPS) detected.")
        logger.info("TTS: Loading XTTS-v2 on MPS (expect accelerated inference)")
    elif _device == "cuda":
        _gpu_name = torch.cuda.get_device_name(0)
        _vram_gb  = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
        logger.info("TTS: GPU detected: %s  |  VRAM: %.1f GB", _gpu_name, _vram_gb)
        logger.info("TTS: Loading XTTS-v2 on CUDA (expect ~5s load, ~5-10s per inference)")
    else:
        logger.info("TTS: No GPU -- loading XTTS-v2 on CPU (expect ~3-5 min per inference)")

    try:
        from TTS.api import TTS as CoquiTTS
        _tts_model = CoquiTTS("tts_models/multilingual/multi-dataset/xtts_v2").to(_device)
        logger.info("TTS: XTTS-v2 loaded successfully on %s", _device.upper())
    except Exception as _load_err:
        logger.error("TTS: Failed to load XTTS-v2 model -- %s", _load_err)
        _tts_model = None

# CUDA/MPS are not thread-safe for concurrent TTS inference -- use 1 worker on GPU.
# CPU can safely parallelize across 2 threads.
# We also use this executor to run native 'say' CLI commands on macOS asynchronously.
_executor = ThreadPoolExecutor(max_workers=1 if _device in ("cuda", "mps") else 2)


def clean_text_for_speech(text: str) -> str:
    """
    Cleans markdown, code blocks, links, bullet points, and formatting characters
    from the input text so it reads naturally when spoken by a speech synthesizer.
    """
    if not text:
        return ""

    # 1. Remove block code snippets (```...```) completely as they are not speakable
    text = re.sub(r"```[\s\S]*?```", " [code snippet omitted] ", text)

    # 2. Convert inline links [link text](url) to just the "link text"
    text = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", text)

    # 3. Remove inline backticks (e.g. `code`)
    text = re.sub(r"`([^`\n]+)`", r"\1", text)

    # 4. Remove bold/italics formatting asterisks and underscores (**, *, __, _)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"\*([^*]+)\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"_([^_]+)_", r"\1", text)

    # 5. Remove headers symbols (e.g. #, ##, etc.) at the start of lines
    text = re.sub(r"^\s*#+\s+", "", text, flags=re.MULTILINE)

    # 6. Remove list bullets (e.g. - , * , + ) at the start of lines
    text = re.sub(r"^\s*[-*+]\s+", "", text, flags=re.MULTILINE)

    # 7. Convert math/LaTeX markers like $E=mc^2$ or \[ ... \] to plain text or clean them
    text = re.sub(r"\$\$([\s\S]*?)\$\$", r"\1", text)
    text = re.sub(r"\$([^$\n]+)\$", r"\1", text)
    text = re.sub(r"\\\[([\s\S]*?)\\\]", r"\1", text)
    text = re.sub(r"\\\((.*?)\\\)", r"\1", text)

    # 8. Clean up extra whitespace and newlines
    text = re.sub(r"\s+", " ", text)
    
    return text.strip()


# ---------------------------------------------------------------------------
# macOS Native TTS Voices & Helper Functions
# ---------------------------------------------------------------------------
def get_installed_voices() -> set[str]:
    """Query available voices using the native macOS `say -v ?` command."""
    if not IS_MACOS:
        return set()
    try:
        res = subprocess.run(["say", "-v", "?"], capture_output=True, text=True, check=True)
        voices = set()
        for line in res.stdout.splitlines():
            if not line.strip():
                continue
            # Match name up to the language code/hash
            match = re.match(r"^([^\t#]+?)\s+[a-zA-Z]{2,3}(?:_[a-zA-Z0-9]{2,4})?\s+#", line)
            if match:
                voices.add(match.group(1).strip())
            else:
                parts = line.split("#")
                if parts:
                    name_part = parts[0].strip()
                    words = name_part.split()
                    if len(words) > 1:
                        name = " ".join(words[:-1])
                        voices.add(name.strip())
        return voices
    except Exception as e:
        logger.warning("TTS: Failed to query system voices: %s", e)
        return set()

# Default mapping of teacher clone IDs to high-quality macOS system voices
MACOS_VOICE_MAPPING = {
    "andrew-ml": "Reed (English (US))",
    "erik-adsa": "Rocko (English (US))",
    "dr-rao": "Grandpa (English (US))",
    "david-c": "Eddy (English (US))",
    "grant-llm": "Grandpa (English (UK))",
    "prof-sharma": "Rishi",
    "ms-priya": "Samantha",
    "vaibhav": "Rishi",
}

# Fallbacks for gender/type when mapped voice is not installed
MACOS_MALE_FALLBACKS = ["Reed (English (US))", "Rocko (English (US))", "Daniel", "Rishi", "Alex"]
MACOS_FEMALE_FALLBACKS = ["Samantha", "Sandy (English (US))", "Shelley (English (US))", "Moira", "Karen"]

def resolve_macos_voice(voice_id: str, installed_voices: set[str]) -> str:
    """Resolve a voice_id to a matching installed macOS system voice."""
    # 1. Direct match (e.g. if the voice_id is already a system voice name, like "Samantha")
    if voice_id in installed_voices:
        return voice_id
        
    # Case-insensitive direct match
    for v in installed_voices:
        if v.lower() == voice_id.lower():
            return v
            
    # 2. Check mapping
    mapped = MACOS_VOICE_MAPPING.get(voice_id)
    if mapped and mapped in installed_voices:
        return mapped
        
    # Check if a mapped voice has case-insensitive match or substring match
    if mapped:
        for v in installed_voices:
            if v.lower() == mapped.lower():
                return v

    # 3. Gender/Role fallbacks
    # We decide if the voice is female based on common patterns
    is_female = voice_id in ["ms-priya"] or "priya" in voice_id.lower() or "female" in voice_id.lower() or "samantha" in voice_id.lower()
    
    fallbacks = MACOS_FEMALE_FALLBACKS if is_female else MACOS_MALE_FALLBACKS
    for fb in fallbacks:
        if fb in installed_voices:
            return fb
            
    # Ultimate fallback: pick first English voice or first voice in installed_voices
    for v in installed_voices:
        if "English" in v or "en" in v.lower() or v in ["Samantha", "Alex", "Daniel"]:
            return v
            
    if installed_voices:
        return list(installed_voices)[0]
        
    return "Alex" # macOS standard fallback


# ---------------------------------------------------------------------------
# Internal sync inference function (runs inside the thread pool)
# ---------------------------------------------------------------------------
def _run_inference(text: str, speaker_wav: str, language: str, output_path: str) -> None:
    """Blocking call to Coqui TTS. Must NOT be called directly from an async context."""
    if _tts_model is None:
        raise RuntimeError(
            "XTTS-v2 model is not loaded. "
            "Ensure 'TTS' is installed and the model download completed."
        )

    _tts_model.tts_to_file(
        text=text,
        speaker_wav=speaker_wav,
        language=language,
        file_path=output_path,
    )

    # Clear CUDA or MPS cache after each chunk on GPU to avoid VRAM fragmentation.
    if _device == "cuda":
        import torch
        torch.cuda.empty_cache()
    elif _device == "mps":
        import torch
        torch.mps.empty_cache()


def split_text_into_chunks(text: str, max_chars: int = 250) -> list[str]:
    """
    Split text into chunks of maximum length, trying to keep sentences intact.
    Respects sentence boundaries (. ! ?) and falls back to word-level splits for long sentences.
    """
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    chunks = []
    current_chunk = ""
    for sentence in sentences:
        if not sentence:
            continue
        # If sentence itself is too long, chunk by words
        if len(sentence) > max_chars:
            if current_chunk:
                chunks.append(current_chunk.strip())
                current_chunk = ""
            words = sentence.split(" ")
            sub_chunk = ""
            for word in words:
                if len(sub_chunk) + len(word) + 1 > max_chars:
                    chunks.append(sub_chunk.strip())
                    sub_chunk = word
                else:
                    sub_chunk = f"{sub_chunk} {word}" if sub_chunk else word
            if sub_chunk:
                current_chunk = sub_chunk
        else:
            if len(current_chunk) + len(sentence) + 1 > max_chars:
                chunks.append(current_chunk.strip())
                current_chunk = sentence
            else:
                current_chunk = f"{current_chunk} {sentence}" if current_chunk else sentence
    if current_chunk:
        chunks.append(current_chunk.strip())
    return chunks


def concatenate_wavs(paths: list[str], output_path: str) -> None:
    """
    Stitches multiple WAV files together using python's built-in wave module.
    Assumes all files have the same structure (e.g. same channel count and frame rate).
    """
    if not paths:
        return
    with wave.open(paths[0], "rb") as first_file:
        params = first_file.getparams()
    with wave.open(output_path, "wb") as output_file:
        output_file.setparams(params)
        for path in paths:
            with wave.open(path, "rb") as input_file:
                output_file.writeframes(input_file.readframes(input_file.getnframes()))


# ---------------------------------------------------------------------------
# Public async API
# ---------------------------------------------------------------------------
class TTSService:
    """
    Async-safe TTS service backed by Coqui XTTS-v2.

    Usage
    -----
    audio_path = await tts_service.generate_audio("Hello world")
    """

    # ------------------------------------------------------------------
    async def generate_audio(
        self,
        text: str,
        voice_id: str = "vaibhav",
        language: str = "en",
        pacing_factor: float = 1.0,
    ) -> str:
        """
        Generate a WAV file from *text* and return its file path.
        On macOS, this uses the native speech synthesis 'say' engine.
        On other platforms, it chunks text and uses Coqui XTTS-v2.

        Parameters
        ----------
        text      : Text to synthesise.
        voice_id  : Key that maps to data/voices/{voice_id}.wav or macOS system voice.
        language  : BCP-47 code accepted by XTTS-v2 (e.g. 'en', 'hi', 'es').
        """
        # Clean text for speech synthesis (strip markdown, links, code snippets)
        cleaned_text = clean_text_for_speech(text)
        if not cleaned_text.strip():
            cleaned_text = "No speakable text provided."

        # 1. Cache Lookup
        import hashlib
        cache_key = hashlib.md5(f"{voice_id}_{language}_{cleaned_text}_{pacing_factor}".encode("utf-8")).hexdigest()
        output_path = str(AUDIO_DIR / f"{cache_key}.wav")
        if os.path.exists(output_path):
            logger.info("TTS: Cache hit! Returning pre-generated audio for key %s", cache_key)
            return output_path

        loop = asyncio.get_event_loop()

        # ------------------------------------------------------------------
        # macOS Native Path
        # ------------------------------------------------------------------
        if IS_MACOS:
            installed_voices = get_installed_voices()
            macos_voice = resolve_macos_voice(voice_id, installed_voices)
            logger.info("TTS: Using macOS native voice '%s' for voice_id '%s'", macos_voice, voice_id)
            
            # Use a temporary file for rendering if speed adjustment is needed
            render_path = output_path
            if pacing_factor != 1.0:
                render_path = str(AUDIO_DIR / f"raw_{uuid.uuid4().hex}.wav")

            cmd = [
                "say",
                "-o", render_path,
                "--file-format=WAVE",
                "--data-format=LEI16@16000",
                "-v", macos_voice,
                cleaned_text
            ]
            
            try:
                await loop.run_in_executor(
                    _executor,
                    lambda: subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                )
            except Exception as e:
                logger.error("TTS: macOS native 'say' command failed: %s", e)
                raise RuntimeError(f"macOS native speech synthesis failed: {e}")

            # Adjust pacing/speed if required (using FFmpeg's atempo filter)
            if pacing_factor != 1.0:
                pacing_factor = max(0.75, min(1.25, pacing_factor))
                logger.info("TTS: applying pacing speed factor %f using FFmpeg", pacing_factor)
                
                speed_adjusted_path = str(AUDIO_DIR / f"speed_{uuid.uuid4().hex}.wav")
                cmd_ffmpeg = [
                    "ffmpeg", "-y",
                    "-i", render_path,
                    "-filter:a", f"atempo={pacing_factor}",
                    speed_adjusted_path
                ]
                try:
                    await loop.run_in_executor(
                        _executor,
                        lambda: subprocess.run(cmd_ffmpeg, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    )
                    
                    if os.path.exists(speed_adjusted_path):
                        if os.path.exists(render_path) and render_path != output_path:
                            os.remove(render_path)
                        elif os.path.exists(output_path):
                            os.remove(output_path)
                        os.rename(speed_adjusted_path, output_path)
                        logger.info("TTS: speed adjustment applied successfully")
                except Exception as e:
                    logger.error("TTS: FFmpeg speed adjustment failed: %s", e)
                    if os.path.exists(speed_adjusted_path):
                        os.remove(speed_adjusted_path)
                    # If ffmpeg fails, fallback to using raw output
                    if render_path != output_path and os.path.exists(render_path):
                        os.rename(render_path, output_path)
                        
            return output_path

        # ------------------------------------------------------------------
        # Coqui XTTS-v2 Fallback Path (Non-macOS)
        # ------------------------------------------------------------------
        # Resolve speaker WAV
        extensions = [".wav", ".aac", ".mp3", ".flac"]
        speaker_wav = None
        
        for ext in extensions:
            candidate = VOICES_DIR / f"{voice_id}{ext}"
            if candidate.exists():
                speaker_wav = candidate
                break
                
        if not speaker_wav:
            logger.warning(
                "TTS: voice_id '%s' reference file not found. Finding fallback...",
                voice_id
            )
            if VOICES_DIR.exists():
                available_files = [
                    p for p in VOICES_DIR.iterdir()
                    if p.suffix in extensions
                ]
                if available_files:
                    speaker_wav = available_files[0]
                    logger.warning(
                        "TTS: fallback selected: '%s' instead of '%s'.",
                        speaker_wav.name,
                        voice_id
                    )
            
        if not speaker_wav:
            raise FileNotFoundError(
                f"Speaker reference file not found for voice_id '{voice_id}' in {VOICES_DIR}, "
                f"and no fallback voice was found. Supported extensions: {extensions}"
            )

        # Split text into chunks.
        chunk_size = 200 if _device in ("cuda", "mps") else 250
        chunks = split_text_into_chunks(cleaned_text, max_chars=chunk_size)
        logger.info("TTS: splitting text into %d chunk(s) [device=%s, chunk_size=%d chars]",
                    len(chunks), _device.upper(), chunk_size)

        # Generate audio files for each chunk sequentially in thread pool
        temp_files = []
        try:
            for idx, chunk in enumerate(chunks):
                temp_path = str(AUDIO_DIR / f"chunk_{uuid.uuid4().hex}.wav")
                logger.info("TTS: generating chunk %d/%d (%d chars)", idx + 1, len(chunks), len(chunk))
                await loop.run_in_executor(
                    _executor,
                    _run_inference,
                    chunk,
                    str(speaker_wav),
                    language,
                    temp_path,
                )
                temp_files.append(temp_path)
            
            # Stitch WAV files together
            concatenate_wavs(temp_files, output_path)
            logger.info("TTS: combined audio saved -> %s", output_path)
            
            # Adjust pacing/speed if required (using FFmpeg's atempo filter)
            if pacing_factor != 1.0:
                pacing_factor = max(0.75, min(1.25, pacing_factor))
                logger.info("TTS: applying pacing speed factor %f using FFmpeg", pacing_factor)
                
                speed_adjusted_path = str(AUDIO_DIR / f"speed_{uuid.uuid4().hex}.wav")
                cmd_ffmpeg = [
                    "ffmpeg", "-y",
                    "-i", output_path,
                    "-filter:a", f"atempo={pacing_factor}",
                    speed_adjusted_path
                ]
                try:
                    await loop.run_in_executor(
                        _executor,
                        lambda: subprocess.run(cmd_ffmpeg, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
                    )
                    
                    if os.path.exists(speed_adjusted_path):
                        if os.path.exists(output_path):
                            os.remove(output_path)
                        os.rename(speed_adjusted_path, output_path)
                        logger.info("TTS: speed adjustment applied successfully")
                except Exception as e:
                    logger.error("TTS: FFmpeg speed adjustment failed: %s", e)
                    if os.path.exists(speed_adjusted_path):
                        os.remove(speed_adjusted_path)
            
            return output_path
        finally:
            # Clean up temporary chunk files
            for temp_file in temp_files:
                if os.path.exists(temp_file):
                    try:
                        os.remove(temp_file)
                    except Exception as e:
                        logger.warning("TTS: failed to remove temp file %s — %s", temp_file, e)


# ---------------------------------------------------------------------------
# Singleton — imported by the router
# ---------------------------------------------------------------------------
tts_service = TTSService()
