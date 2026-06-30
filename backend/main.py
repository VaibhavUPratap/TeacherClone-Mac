from __future__ import annotations
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

# Import config first — this triggers Supabase initialization
import config  # noqa: F401
from services.teacher_service import teacher_service

from routers import auth, chat, ingest, tts, dashboard, clone

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ensure static directory exists
os.makedirs("static/audio", exist_ok=True)

# Mount static files for audio/images
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(auth.router, prefix="/auth")
app.include_router(chat.router, prefix="/chat")
app.include_router(ingest.router, prefix="/ingest")
app.include_router(tts.router, prefix="/tts")
app.include_router(dashboard.router, prefix="/dashboard")
app.include_router(clone.router, prefix="/clone")

@app.on_event("startup")
async def startup_event():
    """Run startup tasks."""
    teacher_service.seed_db()

