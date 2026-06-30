from __future__ import annotations
from fastapi import HTTPException, status
from jose import jwt, JWTError
from config import settings

class AuthService:
    """
    Service responsible for verifying Supabase JWT tokens.
    """

    @staticmethod
    def verify_token(token: str) -> dict:
        """
        Verifies a Supabase JWT token and extracts user identity.
        """
        if not settings.JWT_SECRET:
            raise HTTPException(status_code=500, detail="JWT_SECRET is not configured.")

        try:
            # Supabase tokens are signed with the project's JWT_SECRET using HS256
            # The 'aud' is usually 'authenticated'
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET, 
                algorithms=["HS256"], 
                audience="authenticated"
            )
            
            from config import supabase
            uid = payload.get("sub")
            role = "student"
            
            if supabase is not None and uid:
                try:
                    res = supabase.table("profiles").select("role").eq("id", uid).single().execute()
                    if res.data and "role" in res.data:
                        role = res.data["role"]
                    else:
                        role = payload.get("user_role", "student")
                except Exception as db_err:
                    print(f"Auth DB Role check failed: {db_err}")
                    role = payload.get("user_role", "student")
            else:
                role = payload.get("user_role", "student")

            return {
                "uid": uid,
                "email": payload.get("email", ""),
                "role": role
            }

        except JWTError as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid or expired Supabase JWT token: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Token verification failed: {str(e)}",
                headers={"WWW-Authenticate": "Bearer"},
            )

auth_service = AuthService()
