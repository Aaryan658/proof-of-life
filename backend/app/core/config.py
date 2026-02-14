"""Application configuration via environment variables."""

from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/proof_of_life"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_db_scheme(cls, v: str) -> str:
        """Railway gives postgresql:// – SQLAlchemy async needs postgresql+asyncpg://"""
        if v.startswith("postgresql://"):
            v = v.replace("postgresql://", "postgresql+asyncpg://", 1)
        return v

    # JWT
    JWT_SECRET: str = "super-secret-change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRY_MINUTES: int = 5

    # Challenge
    CHALLENGE_EXPIRY_SECONDS: int = 120

    # CORS
    FRONTEND_URL: str = "http://localhost:3000"

    # CV Pipeline
    FRAME_WIDTH: int = 320  # Downscale target for speed
    EAR_THRESHOLD: float = 0.21
    MAR_THRESHOLD: float = 0.55
    HEAD_TURN_THRESHOLD: float = 0.035  # Normalized ratio
    MIN_CONSECUTIVE_FRAMES: int = 2

    model_config = {"env_file": ".env", "extra": "ignore"}


@lru_cache()
def get_settings() -> Settings:
    return Settings()
