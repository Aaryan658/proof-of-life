"""Challenge generation service."""

import random
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import Challenge

settings = get_settings()

# Available challenge actions
CHALLENGE_POOL = ["blink", "turn_left", "turn_right", "smile", "brow_raise", "tongue_out"]


def generate_challenge_steps(count: int = 3) -> List[str]:
    """Generate a random sequence of unique challenge steps.
    
    Returns a list of `count` randomly selected unique gestures.
    """
    if count > len(CHALLENGE_POOL):
        count = len(CHALLENGE_POOL)
    return random.sample(CHALLENGE_POOL, count)


async def create_challenge(db: AsyncSession) -> Challenge:
    """Create and persist a new challenge in the database."""
    steps = generate_challenge_steps(3)
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.CHALLENGE_EXPIRY_SECONDS)

    challenge = Challenge(
        steps=steps,
        expires_at=expires_at,
    )
    db.add(challenge)
    await db.flush()
    await db.refresh(challenge)
    return challenge
