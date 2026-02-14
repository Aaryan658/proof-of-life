"""JWT token creation, validation, and FastAPI auth dependency."""

import hashlib
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db

settings = get_settings()
security_scheme = HTTPBearer()


def create_access_token(subject: str, extra_claims: Optional[dict] = None) -> tuple[str, datetime]:
    """Create a JWT access token. Returns (token_string, expiry_datetime)."""
    expires = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRY_MINUTES)
    payload = {
        "sub": subject,
        "exp": expires,
        "iat": datetime.now(timezone.utc),
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return token, expires


def verify_token(token: str) -> dict:
    """Decode and verify a JWT token. Raises on failure."""
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def hash_token(token: str) -> str:
    """SHA-256 hash of a token for safe storage."""
    return hashlib.sha256(token.encode()).hexdigest()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security_scheme),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """FastAPI dependency – validates Bearer token and checks DB for revocation."""
    token = credentials.credentials
    payload = verify_token(token)

    # Check if token is revoked in DB
    from app.models.models import AccessToken
    token_h = hash_token(token)
    result = await db.execute(
        select(AccessToken).where(
            AccessToken.token_hash == token_h,
            AccessToken.revoked == False,  # noqa: E712
        )
    )
    db_token = result.scalar_one_or_none()
    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token not found or has been revoked",
        )
    if db_token.expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )

    return payload
