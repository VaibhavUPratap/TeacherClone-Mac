from __future__ import annotations
"""
extract_teacher_features.py
===========================
Run from the backend/ directory:
    python scripts/extract_teacher_features.py

Reads all *_transcript.txt files in data/transcripts/, calls the LLM (Ollama or Gemini)
to extract teaching features (vocabulary level, analogy patterns, pacing), and merges
them into the corresponding {voice_id}_profile.json.
"""

import json
import logging
import os
import sys
from pathlib import Path
import httpx

# Ensure backend/ is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # loads env vars
from config import settings

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

TRANSCRIPTS_DIR = BACKEND_DIR / "data" / "transcripts"

def analyze_transcript(transcript_text: str, teacher_name: str) -> dict:
    """Uses LLM (Ollama or Gemini) to extract teaching features from a transcript snippet."""
    # Take a 6000 character snippet (about 1000 words) from the middle of the transcript
    # to get a representative sample of explanations rather than welcome/intro.
    start_pos = max(0, len(transcript_text) // 3)
    snippet = transcript_text[start_pos : start_pos + 6000]

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

    use_ollama = settings.USE_OLLAMA
    gemini_key = settings.GEMINI_API_KEY

    # Try Ollama first if enabled
    if use_ollama:
        logger.info("  Analyzing with Ollama model: %s", settings.OLLAMA_MODEL)
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
            logger.error("  Ollama analysis failed: %s. Trying Gemini fallback...", e)

    # Use Gemini if Ollama fails or is disabled
    if gemini_key:
        logger.info("  Analyzing with Gemini 2.5 Flash")
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
            logger.error("  Gemini analysis failed: %s", e)

    # Return default fallback if all APIs fail
    logger.warning("  All LLM calls failed. Returning default features.")
    return {
        "vocabulary_level": "Intermediate",
        "analogy_frequency": "Medium",
        "analogy_style": "general examples",
        "pacing_factor": 1.00
    }

def main() -> int:
    if not TRANSCRIPTS_DIR.exists():
        logger.error("Transcripts directory %s does not exist.", TRANSCRIPTS_DIR)
        return 1

    transcript_files = list(TRANSCRIPTS_DIR.glob("*_transcript.txt"))
    if not transcript_files:
        logger.error("No transcripts found in %s.", TRANSCRIPTS_DIR)
        return 1

    logger.info("Found %d transcript(s) for feature extraction.", len(transcript_files))

    success_count = 0

    for file_path in transcript_files:
        voice_id = file_path.stem.replace("_transcript", "")
        profile_path = TRANSCRIPTS_DIR / f"{voice_id}_profile.json"

        logger.info("Processing teacher '%s'...", voice_id)

        # Try to read teacher name from existing profile
        teacher_name = voice_id.capitalize()
        existing_profile = {}
        if profile_path.exists():
            try:
                with open(profile_path, "r", encoding="utf-8") as f:
                    existing_profile = json.load(f)
                teacher_name = existing_profile.get("teacher_name", teacher_name)
            except Exception as e:
                logger.warning("  Could not read existing profile JSON: %s", e)

        try:
            # Read transcript
            with open(file_path, "r", encoding="utf-8") as f:
                transcript_text = f.read()

            if not transcript_text.strip():
                logger.warning("  Transcript file is empty. Skipping.")
                continue

            # Analyze transcript
            features = analyze_transcript(transcript_text, teacher_name)
            logger.info("  Extracted Features: %s", features)

            # Merge features into profile
            profile_data = {
                "voice_id": voice_id,
                "teacher_name": teacher_name,
                **existing_profile,
                "vocabulary_level": features.get("vocabulary_level", "Intermediate"),
                "analogy_frequency": features.get("analogy_frequency", "Medium"),
                "analogy_style": features.get("analogy_style", "general examples"),
                "pacing_factor": float(features.get("pacing_factor", 1.00)),
            }

            # Write updated profile
            with open(profile_path, "w", encoding="utf-8") as f:
                json.dump(profile_data, f, indent=2)

            logger.info("  [OK] Saved profile features to %s", profile_path.name)
            success_count += 1

        except Exception as e:
            logger.error("  Failed to process transcript for '%s': %s", voice_id, e)

    logger.info("Feature extraction complete. Successfully processed: %d/%d", success_count, len(transcript_files))
    return 0

if __name__ == "__main__":
    sys.exit(main())
