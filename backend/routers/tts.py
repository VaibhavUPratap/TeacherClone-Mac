from __future__ import annotations
"""
TTS Router — POST /tts/speak

Responsibilities (router only):
  * Parse and validate the incoming TTSRequest.
  * Delegate ALL logic to tts_service.
  * Return a FileResponse (WAV binary) or a meaningful HTTP error.

No business logic lives here.
"""

import logging
import os

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse

from schemas.tts_schema import TTSRequest
from services.tts_service import tts_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post(
    "/speak",
    summary="Text-to-Speech (XTTS-v2)",
    response_class=FileResponse,
    responses={
        200: {
            "content": {"audio/wav": {}},
            "description": "Synthesised WAV audio file.",
        },
        404: {"description": "Speaker voice file not found."},
        500: {"description": "TTS model error."},
    },
)
async def speak(request: TTSRequest):
    """
    Convert *text* to speech using the locally-running Coqui XTTS-v2 model.

    - **text**: The sentence(s) to synthesise (1–5 000 characters).
    - **voice_id**: Speaker key — must match `data/voices/{voice_id}.wav`.
    - **language**: BCP-47 language code (default `"en"`).

    Returns a downloadable WAV file (`response.wav`).
    """
    try:
        # Fetch pacing factor from teacher profile if available
        pacing_factor = 1.0
        from pathlib import Path
        import json
        profile_path = Path("data/transcripts") / f"{request.voice_id}_profile.json"
        if profile_path.exists():
            try:
                with open(profile_path, "r", encoding="utf-8") as f:
                    profile = json.load(f)
                pacing_factor = float(profile.get("pacing_factor", 1.0))
            except Exception as e:
                logger.warning("TTS: Failed to load pacing factor from profile: %s", e)

        audio_path = await tts_service.generate_audio(
            text=request.text,
            voice_id=request.voice_id,
            language=request.language,
            pacing_factor=pacing_factor,
        )
    except FileNotFoundError as exc:
        logger.warning("TTS speak: voice file missing — %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except RuntimeError as exc:
        logger.error("TTS speak: model error — %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))
    except Exception as exc:  # pragma: no cover
        logger.exception("TTS speak: unexpected error")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {exc}")

    # Confirm the file was actually written before responding
    if not os.path.exists(audio_path):
        raise HTTPException(
            status_code=500, detail="Audio file was not created by the TTS engine."
        )

    return FileResponse(
        path=audio_path,
        media_type="audio/wav",
        filename="response.wav",
    )


@router.get(
    "/voices",
    summary="List available speaker voices",
    response_model=list[str],
)
async def list_voices():
    """
    Return the list of speaker voice keys that are available on this server.
    Each key corresponds to a WAV file in `data/voices/`.
    """
    from pathlib import Path

    voices_dir = Path("data/voices")
    if not voices_dir.exists():
        return []

    return [p.stem for p in voices_dir.iterdir() if p.suffix in [".wav", ".aac", ".mp3", ".flac"]]


@router.post(
    "/upload",
    summary="Upload a reference voice file",
)
async def upload_voice(voice_id: str, file: UploadFile = File(...)):
    """
    Upload a reference voice file (WAV, AAC, MP3, or FLAC) and save it to data/voices/.
    It will be saved as {voice_id}{ext} and can be used as a speaker reference for TTS.
    """
    # Verify file extension
    ext = os.path.splitext(file.filename)[-1].lower()
    if ext not in [".wav", ".aac", ".mp3", ".flac"]:
        raise HTTPException(status_code=400, detail="Unsupported audio format. Use WAV, AAC, MP3, or FLAC.")
    
    from pathlib import Path
    voices_dir = Path("data/voices")
    voices_dir.mkdir(parents=True, exist_ok=True)
    
    target_path = voices_dir / f"{voice_id}{ext}"
    try:
        content = await file.read()
        with open(target_path, "wb") as f:
            f.write(content)
        logger.info("Voice file saved to %s", target_path)

        # Write metadata to public.voices table in Supabase
        from config import supabase
        if supabase is not None:
            try:
                supabase.table("voices").upsert({
                    "id": voice_id,
                    "filename": f"{voice_id}{ext}"
                }).execute()
                logger.info("Successfully recorded voice '%s' in Supabase database.", voice_id)
            except Exception as db_err:
                logger.error("Failed to insert voice '%s' in Supabase public.voices table: %s", voice_id, db_err)

        return {"success": True, "voice_id": voice_id, "filename": file.filename}
    except Exception as e:
        logger.error("Failed to save voice file — %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to save voice file: {str(e)}")


@router.get(
    "/voices/{voice_id}",
    summary="Stream a speaker voice file",
    response_class=FileResponse,
)
async def get_voice_file(voice_id: str):
    """
    Stream a speaker voice file by its voice_id.
    """
    from pathlib import Path
    voices_dir = Path("data/voices")
    extensions = [".wav", ".aac", ".mp3", ".flac"]
    
    target_path = None
    for ext in extensions:
        candidate = voices_dir / f"{voice_id}{ext}"
        if candidate.exists():
            target_path = candidate
            break
            
    if not target_path:
        raise HTTPException(status_code=404, detail=f"Voice file '{voice_id}' not found.")
        
    media_type = "audio/wav"
    if target_path.suffix == ".aac":
        media_type = "audio/aac"
    elif target_path.suffix == ".mp3":
        media_type = "audio/mpeg"
    elif target_path.suffix == ".flac":
        media_type = "audio/flac"
        
    return FileResponse(path=str(target_path), media_type=media_type)
