from __future__ import annotations
from fastapi import APIRouter
from schemas.dashboard_schema import DashboardStats, Subject, TeacherClone, Resource
from services.dashboard_service import dashboard_service
from services.teacher_service import teacher_service
from typing import List

router = APIRouter()


@router.get("/", response_model=DashboardStats)
def get_dashboard():
    """
    Returns analytics and stats for the teacher dashboard.
    """
    return dashboard_service.get_stats()

@router.get("/subjects", response_model=List[Subject])
def get_subjects():
    """Returns all available subjects."""
    return teacher_service.get_subjects()

@router.get("/subjects/{subject_id}/resources", response_model=List[Resource])
def get_resources(subject_id: str):
    """Returns all resources for a given subject."""
    return teacher_service.get_resources_by_subject(subject_id)

@router.get("/resources/{resource_id}", response_model=Resource)
def get_resource(resource_id: str):
    """Returns a specific resource's details."""
    return teacher_service.get_resource_by_id(resource_id)

@router.get("/teachers/{subject_id}", response_model=List[TeacherClone])
def get_teachers(subject_id: str):
    """Returns all teacher clones for a given subject."""
    return teacher_service.get_teachers_by_subject(subject_id)
