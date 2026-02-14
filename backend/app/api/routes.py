"""API routes for the Proof-of-Life verification system."""

import asyncio
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.database import get_db
from app.core.security import create_access_token, get_current_user, hash_token
from app.models.models import AccessToken, Challenge, VerificationAttempt
from app.services.challenge import create_challenge
from app.services.vision import analyze_frames

settings = get_settings()
router = APIRouter(prefix="/api", tags=["verification"])


# ──────────────────────── Request/Response Schemas ────────────────────────

class ChallengeResponse(BaseModel):
    challenge_id: str
    steps: List[str]
    expires_at: str
    expires_in_seconds: int


class VerifyRequest(BaseModel):
    challenge_id: str
    frames: List[str] = Field(..., min_length=1, max_length=60, description="Base64-encoded frames")


class StepResult(BaseModel):
    step: str
    detected: bool
    confidence: float
    frame_idx: int


class VerifyResponse(BaseModel):
    passed: bool
    liveness_score: float
    step_results: List[StepResult]
    face_detected_count: int
    total_frames: int
    temporal_valid: bool
    token: Optional[str] = None
    token_expires_at: Optional[str] = None
    error: Optional[str] = None


class ProtectedResponse(BaseModel):
    message: str
    user: str
    token_issued_at: str
    token_expires_at: str
    access_level: str


class AttackSimRequest(BaseModel):
    frames: List[str] = Field(..., min_length=1, max_length=10, description="Base64 frames of static image/video")


class AttackSimResponse(BaseModel):
    passed: bool
    liveness_score: float
    rejection_reason: str
    step_results: List[StepResult]
    recommendation: str


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str


# ──────────────────────── Endpoints ────────────────────────────────────

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return HealthResponse(
        status="healthy",
        timestamp=datetime.now(timezone.utc).isoformat(),
        version="1.0.0",
    )


@router.post("/challenge", response_model=ChallengeResponse)
async def generate_challenge(db: AsyncSession = Depends(get_db)):
    """Generate a new randomized multi-step challenge.
    
    Returns a unique challenge ID with steps to perform and an expiration time.
    Each challenge can only be used once.
    """
    challenge = await create_challenge(db)
    expires_in = int((challenge.expires_at - datetime.now(timezone.utc)).total_seconds())

    return ChallengeResponse(
        challenge_id=str(challenge.id),
        steps=challenge.steps,
        expires_at=challenge.expires_at.isoformat(),
        expires_in_seconds=expires_in,
    )


@router.post("/verify", response_model=VerifyResponse)
async def verify_liveness(
    body: VerifyRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Verify liveness by analyzing frames against a challenge.
    
    Accepts a challenge_id and a sequence of base64-encoded video frames.
    Runs the CV pipeline to detect challenge actions in temporal order.
    On success, issues a short-lived JWT access token.
    """
    # 1. Validate challenge exists and is not expired/used
    result = await db.execute(
        select(Challenge).where(Challenge.id == body.challenge_id)
    )
    challenge = result.scalar_one_or_none()

    if challenge is None:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if challenge.used:
        raise HTTPException(status_code=410, detail="Challenge already used (replay protection)")

    if challenge.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Challenge expired")

    # 2. Mark challenge as used (one-time use - replay protection)
    challenge.used = True

    # 3. Run CV pipeline (CPU-bound → run in thread pool to avoid blocking)
    cv_result = await asyncio.to_thread(analyze_frames, body.frames, challenge.steps)

    # 4. Store verification attempt
    attempt = VerificationAttempt(
        challenge_id=challenge.id,
        liveness_score=cv_result["liveness_score"],
        passed=cv_result["passed"],
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent"),
        details=cv_result["step_results"],
    )
    db.add(attempt)

    # 5. Issue token on success
    token_str = None
    token_expires = None
    if cv_result["passed"]:
        token_str, expires_at = create_access_token(
            subject=f"verified-user-{challenge.id}",
            extra_claims={"liveness_score": cv_result["liveness_score"]},
        )
        # Store token hash in DB
        db_token = AccessToken(
            token_hash=hash_token(token_str),
            user_label=f"Challenge {str(challenge.id)[:8]}",
            expires_at=expires_at,
        )
        db.add(db_token)
        token_expires = expires_at.isoformat()

    await db.flush()

    return VerifyResponse(
        passed=cv_result["passed"],
        liveness_score=cv_result["liveness_score"],
        step_results=[StepResult(**s) for s in cv_result["step_results"]],
        face_detected_count=cv_result["face_detected_count"],
        total_frames=cv_result["total_frames"],
        temporal_valid=cv_result["temporal_valid"],
        token=token_str,
        token_expires_at=token_expires,
    )


@router.get("/protected", response_model=ProtectedResponse)
async def protected_resource(user: dict = Depends(get_current_user)):
    """Protected endpoint – requires a valid, unexpired JWT token.
    
    This demonstrates that only verified live humans can access this resource.
    """
    return ProtectedResponse(
        message="🛡️ Access granted. You are a verified live human.",
        user=user.get("sub", "unknown"),
        token_issued_at=datetime.fromtimestamp(user.get("iat", 0), tz=timezone.utc).isoformat(),
        token_expires_at=datetime.fromtimestamp(user.get("exp", 0), tz=timezone.utc).isoformat(),
        access_level="full",
    )


@router.post("/attack-sim", response_model=AttackSimResponse)
async def attack_simulation(body: AttackSimRequest):
    """Attack simulation endpoint.
    
    Accepts frames (e.g., from a static photo or pre-recorded video)
    and demonstrates that the system rejects non-live inputs.
    The challenge used here is a fixed set of all actions.
    """
    # Use a fixed challenge covering all actions
    sim_steps = ["blink", "turn_right", "smile"]

    cv_result = analyze_frames(body.frames, sim_steps)

    # Determine rejection reason
    if cv_result["face_detected_count"] == 0:
        reason = "No face detected in any frame"
    elif not cv_result["temporal_valid"]:
        reason = "No temporal variation detected — likely a static image"
    elif cv_result["liveness_score"] < 60:
        reason = f"Liveness score too low ({cv_result['liveness_score']}%) — insufficient gestural response"
    else:
        reason = "Frames showed motion but failed challenge ordering"

    steps_detected = sum(1 for s in cv_result["step_results"] if s["detected"])

    return AttackSimResponse(
        passed=cv_result["passed"],
        liveness_score=cv_result["liveness_score"],
        rejection_reason=reason if not cv_result["passed"] else "N/A — passed (unexpected for attack sim)",
        step_results=[StepResult(**s) for s in cv_result["step_results"]],
        recommendation=(
            "✅ Attack successfully rejected. Static images and replays cannot produce "
            "the required temporal sequence of gestural responses."
            if not cv_result["passed"]
            else "⚠️ Frames unexpectedly passed — review challenge difficulty."
        ),
    )
