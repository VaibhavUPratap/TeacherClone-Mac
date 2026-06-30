from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from schemas.auth_schema import SupabaseUser
from services.auth_service import auth_service

router = APIRouter()
_bearer_scheme = HTTPBearer()

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> SupabaseUser:
    """
    FastAPI dependency that extracts and verifies the Supabase JWT token
    from the 'Authorization: Bearer <token>' header.
    """
    token = credentials.credentials
    user_data = auth_service.verify_token(token)
    return SupabaseUser(**user_data)

@router.get("/me", response_model=SupabaseUser)
def me(current_user: SupabaseUser = Depends(get_current_user)):
    """
    Returns the identity of the currently authenticated user.
    """
    return current_user
