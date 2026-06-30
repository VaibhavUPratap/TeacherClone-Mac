from __future__ import annotations
import os
import sys

# Add common macOS Homebrew paths to PATH dynamically if they exist
for brew_path in ["/opt/homebrew/bin", "/usr/local/bin"]:
    if os.path.exists(brew_path) and brew_path not in os.environ.get("PATH", ""):
        os.environ["PATH"] = brew_path + os.path.pathsep + os.environ["PATH"]

from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

class Settings(BaseSettings):
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    JWT_SECRET: str = os.getenv("JWT_SECRET", "supersecret")
    USE_OLLAMA: bool = os.getenv("USE_OLLAMA", "false").lower() in ("true", "1", "t", "yes")

    # Supabase Settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Supabase Settings
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    # Ollama Settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "llama3")
    OLLAMA_EMBED_MODEL: str = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

    # Frontend Settings
    VITE_API_BASE_URL: str = os.getenv("VITE_API_BASE_URL", "http://localhost:8000")

    # Model config to read from .env file
    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()

# ---------------------------------------------------------------------------
# Supabase Client Initialization
# ---------------------------------------------------------------------------
supabase: Client | None = None
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
    try:
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
        print("[OK] Supabase client initialized securely.")
    except Exception as e:
        print(f"[ERROR] Failed to initialize Supabase client: {e}")
else:
    print("[WARNING] Supabase credentials not found in environment variables.")

