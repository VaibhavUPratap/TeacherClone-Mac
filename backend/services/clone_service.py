"""
clone_service.py
================
Orchestrates the full teacher clone creation pipeline:

  1. Save uploaded video to data/videos/
  2. Extract + normalize voice reference WAV (FFmpeg + WebRTC VAD)
  3. Transcribe video with OpenAI Whisper (local)
  4. Extract teaching personality from transcript (Ollama)
  5. Upsert teacher clone into Supabase public.teachers
  6. Upsert voice record into Supabase public.voices

Each pipeline run is tracked as a "job" (in-memory dict keyed by job_id).
Poll GET /clone/status/{job_id} for live progress.
"""

from __future__ import annotations

import json
import logging
import threading
import time
import uuid
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parent.parent
VIDEOS_DIR  = BACKEND_DIR / "data" / "videos"
VOICES_DIR  = BACKEND_DIR / "data" / "voices"
TRANSCRIPTS_DIR = BACKEND_DIR / "data" / "transcripts"

for _d in (VIDEOS_DIR, VOICES_DIR, TRANSCRIPTS_DIR):
    _d.mkdir(parents=True, exist_ok=True)

# ---------------------------------------------------------------------------
# In-memory job registry
# ---------------------------------------------------------------------------
_jobs: dict[str, dict] = {}   # job_id -> { status, progress, message, teacher_id, ... }

STAGES = [
    (10,  "Saving video..."),
    (25,  "Extracting voice sample..."),
    (50,  "Transcribing lecture with Whisper..."),
    (75,  "Extracting teaching personality..."),
    (90,  "Saving clone to database..."),
    (100, "Clone ready!"),
]


def _set_stage(job_id: str, progress: int, message: str, status: str = "running"):
    _jobs[job_id].update({"progress": progress, "message": message, "status": status})
    logger.info("[Job %s] %d%% — %s", job_id[:8], progress, message)


# ---------------------------------------------------------------------------
# Personality extraction (Ollama)
# ---------------------------------------------------------------------------
_PERSONALITY_PROMPT_TMPL = """\
You are an AI assistant that analyses lecture transcripts to understand a teacher's style.

Below is a transcript excerpt from {teacher_name}'s lecture on {subject}.

TRANSCRIPT:
\"\"\"
{excerpt}
\"\"\"

Based on this transcript, write a system prompt (200-300 words) that will make an AI \
assistant sound and teach exactly like this teacher.
The prompt must describe:
1. Teaching style (step-by-step, conceptual, example-driven, etc.)
2. Vocabulary level and tone (formal/casual, technical depth)
3. How they structure explanations (analogies, proofs, code examples)
4. Characteristic phrases or habits observed
5. How they engage with students

Respond with ONLY the system prompt text. No explanation, no labels, no markdown.
Start with: "You are {teacher_name}, a {subject} instructor..."
"""


def _extract_personality(transcript: str, teacher_name: str, subject: str) -> str:
    try:
        import httpx
        from config import settings
        mid = len(transcript) // 4
        excerpt = transcript[mid: mid + 8000]
        prompt = _PERSONALITY_PROMPT_TMPL.format(
            teacher_name=teacher_name, subject=subject, excerpt=excerpt
        )
        resp = httpx.post(
            f"{settings.OLLAMA_BASE_URL}/api/generate",
            json={"model": settings.OLLAMA_MODEL, "prompt": prompt, "stream": False},
            timeout=120.0,
        )
        resp.raise_for_status()
        personality = resp.json().get("response", "").strip()
        if personality:
            return personality
    except Exception as exc:
        logger.warning("Personality extraction failed: %s", exc)

    # Fallback
    return (
        f"You are {teacher_name}, an expert {subject} instructor. "
        f"You teach with clarity and precision, using real-world examples and "
        f"step-by-step breakdowns. Your tone is engaging and encouraging. "
        f"You always check for student understanding before moving on."
    )


def _extract_features(transcript: str, teacher_name: str) -> dict:
    """Uses LLM (Ollama or Gemini) to extract teaching features from a transcript snippet."""
    # Take a 6000 character snippet (about 1000 words) from the middle of the transcript
    start_pos = max(0, len(transcript) // 3)
    snippet = transcript[start_pos : start_pos + 6000]

    prompt = (
        f"You are a linguistic researcher analyzing a teacher's lecture transcript. "
        f"Analyze this lecture snippet by teacher '{teacher_name}' to extract the following features:\n\n"
        f"1. vocabulary_level: Rate the teacher's terminology usage as 'Beginner' (explains basic concepts, minimal jargon), "
        f"'Intermediate' (typical college-level explanations), or 'Advanced' (highly technical, mathematically rigorous, heavy jargon).\n"
        f"2. analogy_frequency: Rate how often they use analogies/metaphors as 'High' (constantly uses metaphors to explain concepts), "
        f"'Medium' (uses analogies occasionally), or 'Low' (uses direct abstract explanations, focusing strictly on math/formulas).\n"
        f"3. analogy_style: Describe the specific style or source of their analogies (e.g. 'physical landscapes', 'real-world software design', "
        f"'metaphorical stories', 'visual geometry'). Max 10 words.\n"
        f"4. pacing_factor: Estimate a recommended playback speed multiplier (between 0.85 and 1.15) for their voice. "
        f"If they explain very slowly, pause often, or are extremely methodical, recommend 0.90 to 0.95. "
        f"If they explain at a normal, standard conversational pace, recommend 1.00. "
        f"If they speak fast, energetic, or with highly compressed explanations, recommend 1.05 to 1.15.\n\n"
        f"Respond STRICTLY in JSON format: \n"
        f"{{\n"
        f"  \"vocabulary_level\": \"Beginner\" | \"Intermediate\" | \"Advanced\",\n"
        f"  \"analogy_frequency\": \"High\" | \"Medium\" | \"Low\",\n"
        f"  \"analogy_style\": \"string\",\n"
        f"  \"pacing_factor\": float\n"
        f"}}\n\n"
        f"--- LECTURE SNIPPET ---\n"
        f"{snippet}"
    )

    try:
        import httpx
        from config import settings
        use_ollama = settings.USE_OLLAMA
        gemini_key = settings.GEMINI_API_KEY

        if use_ollama:
            logger.info("Analyzing clone features with Ollama model: %s", settings.OLLAMA_MODEL)
            url = f"{settings.OLLAMA_BASE_URL}/api/chat"
            payload = {
                "model": settings.OLLAMA_MODEL,
                "messages": [{"role": "user", "content": prompt}],
                "stream": False,
                "format": "json"
            }
            try:
                with httpx.Client(timeout=60.0) as client:
                    r = client.post(url, json=payload)
                    r.raise_for_status()
                    res_data = r.json()
                    content = res_data["message"]["content"]
                    return json.loads(content)
            except Exception as e:
                logger.error("Ollama feature extraction failed: %s. Trying Gemini fallback...", e)

        if gemini_key:
            logger.info("Analyzing clone features with Gemini 2.5 Flash")
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
            payload = {
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {
                    "responseMimeType": "application/json"
                }
            }
            try:
                with httpx.Client(timeout=30.0) as client:
                    r = client.post(url, json=payload, headers={"Content-Type": "application/json"})
                    r.raise_for_status()
                    res_data = r.json()
                    content = res_data["candidates"][0]["content"]["parts"][0]["text"]
                    return json.loads(content)
            except Exception as e:
                logger.error("Gemini feature extraction failed: %s", e)

    except Exception as exc:
        logger.warning("Feature extraction failed: %s", exc)

    return {
        "vocabulary_level": "Intermediate",
        "analogy_frequency": "Medium",
        "analogy_style": "general examples",
        "pacing_factor": 1.00
    }


# ---------------------------------------------------------------------------
# Voice fallback — pick another voice for the same subject
# ---------------------------------------------------------------------------
def _find_fallback_voice(subject_id: str, exclude_voice_id: str) -> str | None:
    """Return the first available voice_id whose teacher belongs to subject_id."""
    try:
        from config import supabase
        if supabase:
            rows = (
                supabase.table("teachers")
                .select("voice_id")
                .eq("subject_id", subject_id)
                .neq("voice_id", exclude_voice_id)
                .execute()
            )
            for row in (rows.data or []):
                vid = row.get("voice_id")
                if vid:
                    for ext in (".wav", ".aac", ".mp3", ".flac"):
                        if (VOICES_DIR / f"{vid}{ext}").exists():
                            return vid
    except Exception as exc:
        logger.warning("Fallback voice lookup failed: %s", exc)

    # Last resort: any voice file on disk
    for p in VOICES_DIR.iterdir():
        if p.suffix in (".wav", ".aac", ".mp3", ".flac") and p.stem != exclude_voice_id:
            return p.stem
    return None


# ---------------------------------------------------------------------------
# Main pipeline (runs in background thread)
# ---------------------------------------------------------------------------
def _run_pipeline(
    job_id: str,
    video_path: Path,
    teacher_name: str,
    subject_id: str,
    subject_name: str,
    voice_id: str,
    teaching_style: str,
    description: str,
    avatar_seed: str,
):
    try:
        # ── Stage 1: Video already saved (caller does this) ─────────────────
        _set_stage(job_id, 10, "Video saved.")
        time.sleep(0.5)

        # ── Stage 2: Extract voice reference ────────────────────────────────
        _set_stage(job_id, 25, "Extracting voice sample from video...")
        voice_wav = VOICES_DIR / f"{voice_id}.wav"
        voice_ok = False

        try:
            from services.voice_extraction_service import extract_voice_reference
            teacher_cfg = {
                "voice_id": voice_id,
                "teacher_name": teacher_name,
                "subject": subject_name,
                "skip_intro_s": 5.0,
                "vad_aggressiveness": 2,
                "apply_loudnorm": True,
            }
            # Remove cached file so extraction always runs fresh for new upload
            if voice_wav.exists():
                voice_wav.unlink()
            extract_voice_reference(
                video_path=video_path,
                voice_id=voice_id,
                teacher_cfg=teacher_cfg,
            )
            voice_ok = voice_wav.exists()
        except Exception as exc:
            logger.warning("Voice extraction failed: %s — trying fallback", exc)

        if not voice_ok:
            fallback = _find_fallback_voice(subject_id, voice_id)
            _jobs[job_id]["fallback_voice"] = fallback
            logger.info("Using fallback voice: %s", fallback)

        # ── Stage 3: Transcribe ─────────────────────────────────────────────
        _set_stage(job_id, 50, "Transcribing lecture (this may take a few minutes)...")
        transcript_path = TRANSCRIPTS_DIR / f"{voice_id}_transcript.txt"
        transcript = ""

        try:
            import whisper, torch
            device = "mps" if torch.backends.mps.is_available() else ("cuda" if torch.cuda.is_available() else "cpu")
            model = whisper.load_model("base", device=device)
            result = model.transcribe(str(video_path), language="en", verbose=False)
            transcript = result["text"]
            transcript_path.write_text(transcript, encoding="utf-8")
            logger.info("Transcript: %d chars", len(transcript))
        except Exception as exc:
            logger.warning("Whisper transcription failed: %s", exc)
            transcript = f"Lecture by {teacher_name} on {subject_name}."

        # ── Stage 4: Extract personality & features ─────────────────────────
        _set_stage(job_id, 75, "Extracting teaching personality and features with AI...")
        personality_prompt = _extract_personality(transcript, teacher_name, subject_name)
        _jobs[job_id]["personality_prompt"] = personality_prompt

        # Extract features (vocab, analogy, pacing)
        features = _extract_features(transcript, teacher_name)
        profile_path = TRANSCRIPTS_DIR / f"{voice_id}_profile.json"
        try:
            profile_data = {
                "voice_id": voice_id,
                "teacher_name": teacher_name,
                "vocabulary_level": features.get("vocabulary_level", "Intermediate"),
                "analogy_frequency": features.get("analogy_frequency", "Medium"),
                "analogy_style": features.get("analogy_style", "general examples"),
                "pacing_factor": float(features.get("pacing_factor", 1.00)),
            }
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(profile_data, f, indent=2)
            logger.info("Saved profile JSON for cloned teacher: %s", profile_path)
        except Exception as exc:
            logger.error("Failed to save profile JSON for cloned teacher: %s", exc)

        # ── Stage 5: Save to Supabase ───────────────────────────────────────
        _set_stage(job_id, 90, "Saving clone to database...")
        teacher_id = voice_id  # use voice_id as teacher_id for uniqueness

        effective_voice_id = voice_id if voice_ok else (_jobs[job_id].get("fallback_voice") or voice_id)

        teacher_record = {
            "id": teacher_id,
            "name": teacher_name,
            "subject_id": subject_id,
            "teaching_style": teaching_style or "Dynamic & Engaging",
            "description": description or f"{teacher_name} — {subject_name} instructor",
            "avatar_url": f"https://api.dicebear.com/7.x/avataaars/svg?seed={avatar_seed or voice_id}",
            "personality_prompt": personality_prompt,
            "voice_id": effective_voice_id,
        }

        try:
            from config import supabase
            if supabase:
                supabase.table("teachers").upsert(teacher_record).execute()
                supabase.table("voices").upsert({
                    "id": effective_voice_id,
                    "filename": f"{effective_voice_id}.wav",
                }).execute()
                logger.info("Teacher clone '%s' saved to Supabase.", teacher_id)
        except Exception as exc:
            logger.error("Supabase upsert failed: %s", exc)

        _jobs[job_id].update({
            "status": "completed",
            "progress": 100,
            "message": "Clone ready!",
            "teacher_id": teacher_id,
            "teacher": teacher_record,
            "voice_ok": voice_ok,
            "features": profile_data if 'profile_data' in locals() else None,
        })

    except Exception as exc:
        logger.exception("Pipeline failed for job %s", job_id)
        _jobs[job_id].update({
            "status": "failed",
            "progress": 0,
            "message": f"Pipeline error: {exc}",
        })


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
class CloneService:

    def start_clone_job(
        self,
        video_bytes: bytes,
        filename: str,
        teacher_name: str,
        subject_id: str,
        subject_name: str,
        teaching_style: str = "",
        description: str = "",
        avatar_seed: str = "",
    ) -> dict:
        """
        Save uploaded video and kick off the clone pipeline in a background thread.
        Returns { job_id } immediately.
        """
        job_id = str(uuid.uuid4())
        # Derive a safe voice_id from the teacher name
        voice_id = teacher_name.lower().replace(" ", "-") + "-" + job_id[:6]

        # Save video
        ext = Path(filename).suffix.lower() or ".mp4"
        video_path = VIDEOS_DIR / f"{voice_id}{ext}"
        video_path.write_bytes(video_bytes)

        _jobs[job_id] = {
            "job_id": job_id,
            "status": "running",
            "progress": 5,
            "message": "Pipeline starting...",
            "teacher_name": teacher_name,
            "subject_id": subject_id,
            "voice_id": voice_id,
            "created_at": datetime.now().isoformat(),
            "personality_prompt": None,
            "teacher_id": None,
        }

        thread = threading.Thread(
            target=_run_pipeline,
            args=(job_id, video_path, teacher_name, subject_id, subject_name,
                  voice_id, teaching_style, description, avatar_seed),
            daemon=True,
        )
        thread.start()
        return {"job_id": job_id, "voice_id": voice_id}

    def get_job_status(self, job_id: str) -> dict | None:
        return _jobs.get(job_id)

    def update_personality(self, teacher_id: str, personality_prompt: str) -> bool:
        """Allow admin to edit the personality prompt after extraction."""
        try:
            from config import supabase
            if supabase:
                supabase.table("teachers").update(
                    {"personality_prompt": personality_prompt}
                ).eq("id", teacher_id).execute()
            return True
        except Exception as exc:
            logger.error("Failed to update personality: %s", exc)
            return False

    def list_clones(self) -> list:
        try:
            from config import supabase
            if supabase:
                resp = supabase.table("teachers").select("*").execute()
                return resp.data or []
        except Exception as exc:
            logger.error("Failed to list clones: %s", exc)
        return []

    def delete_clone(self, teacher_id: str) -> bool:
        try:
            from config import supabase
            if supabase:
                supabase.table("teachers").delete().eq("id", teacher_id).execute()
            return True
        except Exception as exc:
            logger.error("Failed to delete clone: %s", exc)
            return False


clone_service = CloneService()
