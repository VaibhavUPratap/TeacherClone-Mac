from __future__ import annotations
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from services.clone_service import clone_service
from services.teacher_service import teacher_service
from schemas.dashboard_schema import TeacherClone
from typing import List, Optional
from pydantic import BaseModel

router = APIRouter()

class PersonalityUpdate(BaseModel):
    personality_prompt: str

@router.post("/create")
async def create_clone(
    teacher_name: str = Form(...),
    subject_id: str = Form(...),
    teaching_style: Optional[str] = Form(""),
    description: Optional[str] = Form(""),
    avatar_seed: Optional[str] = Form(""),
    file: UploadFile = File(...)
):
    # Find subject name dynamically
    subjects = teacher_service.get_subjects()
    subject_name = None
    for s in subjects:
        sid = s.get("id") if isinstance(s, dict) else getattr(s, "id", None)
        if sid == subject_id:
            subject_name = s.get("name") if isinstance(s, dict) else getattr(s, "name", None)
            break

    if not subject_name:
        subject_name = subject_id  # Fallback

    # Read video file bytes
    file_bytes = await file.read()
    
    # Start the cloning pipeline
    job_info = clone_service.start_clone_job(
        video_bytes=file_bytes,
        filename=file.filename,
        teacher_name=teacher_name,
        subject_id=subject_id,
        subject_name=subject_name,
        teaching_style=teaching_style,
        description=description,
        avatar_seed=avatar_seed,
    )
    return job_info

@router.get("/status/{job_id}")
def get_job_status(job_id: str):
    status = clone_service.get_job_status(job_id)
    if not status:
        raise HTTPException(status_code=404, detail="Job not found")
    return status

@router.get("/list", response_model=List[TeacherClone])
def list_clones():
    return clone_service.list_clones()

@router.patch("/{teacher_id}/finalize")
def finalize_clone(teacher_id: str, data: PersonalityUpdate):
    success = clone_service.update_personality(teacher_id, data.personality_prompt)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update personality prompt")
    return {"status": "success", "message": "Personality prompt finalized."}

@router.delete("/{teacher_id}")
def delete_clone(teacher_id: str):
    success = clone_service.delete_clone(teacher_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete clone")
    return {"status": "success", "message": "Clone deleted."}
