from __future__ import annotations
from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from schemas.chat_schema import ChatRequest, ChatResponse
from services.chat_service import chat_service

router = APIRouter()


@router.post("/ask", response_model=ChatResponse)
def ask(request: ChatRequest):
    """
    Hands over the question to the chat service for processing.
    Clean Architecture: Router handles HTTP, Service handles logic.
    """
    result = chat_service.generate_answer(request.question)
    return result


@router.get("/stream")
async def stream(question: str, teacher_id: str = None):
    """
    Real-time streaming endpoint using Server-Sent Events (SSE).
    Calls the async generator in ChatService.
    """
    return StreamingResponse(
        chat_service.stream_answer(question, teacher_id),
        media_type="text/event-stream"
    )


@router.get("/history")
def get_history(limit: int = 50):
    """
    Retrieves past chat history.
    """
    return chat_service.get_history(limit)
