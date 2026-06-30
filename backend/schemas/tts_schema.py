from __future__ import annotations
from pydantic import BaseModel, Field


class TTSRequest(BaseModel):
    """Request body for the POST /tts/speak endpoint."""

    text: str = Field(
        ...,
        min_length=1,
        max_length=5000,
        description="The text to synthesise (max 5 000 characters).",
    )
    # Future-ready: caller can request a specific teacher voice.
    # Maps to backend/data/voices/{voice_id}.wav
    voice_id: str = Field(
        default="vaibhav",
        description="Speaker voice key — must match a supported audio file in data/voices/.",
    )
    language: str = Field(
        default="en",
        description="BCP-47 language code supported by XTTS-v2 (e.g. 'en', 'hi', 'es').",
    )


class TTSResponse(BaseModel):
    """Response returned when TTS generation succeeds.

    NOTE: The /speak endpoint returns a FileResponse (WAV binary) directly.
    This schema is used by future endpoints that need a JSON envelope,
    e.g. a queued/async job endpoint.
    """

    audio_url: str = Field(description="Relative URL to stream/download the WAV file.")
    duration_chars: int = Field(description="Number of characters actually synthesised.")
    voice_id: str = Field(description="The voice key that was used.")
    language: str = Field(description="The language code that was used.")
