from __future__ import annotations
from typing import Optional
from pydantic import BaseModel

class IngestResponse(BaseModel):
    file_id: Optional[str] = None
    status: str
    chunk_count: Optional[int] = None
    detail: Optional[str] = None

class StatusResponse(BaseModel):
    file_id: str
    status: str
