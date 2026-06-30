from __future__ import annotations
from pydantic import BaseModel
from typing import List

class RecentQuestion(BaseModel):
    question: str
    category: str
    time: str

class Subject(BaseModel):
    id: str
    name: str
    icon: str # Lucide icon name or emoji
    description: str
    enrolled_count: int

class Resource(BaseModel):
    id: str
    title: str
    type: str # e.g., 'Lecture PDF', 'Class Notes'
    description: str
    content: str # Mock content for explanation

class TeacherClone(BaseModel):
    id: str
    name: str
    subject_id: str
    teaching_style: str
    description: str
    avatar_url: str
    personality_prompt: str
    voice_id: str

class DashboardStats(BaseModel):
    total_questions: int
    top_topics: List[str]
    weak_areas: List[str]
    recent_questions: List[RecentQuestion]

class TeacherSelectionData(BaseModel):
    subjects: List[Subject]
    teachers: List[TeacherClone]
