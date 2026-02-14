"""FastAPI application entry point for Proof-of-Life Authentication System."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.database import init_db
from app.api.routes import router

settings = get_settings()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan – runs on startup and shutdown."""
    logger.info("🚀 Starting Proof-of-Life backend...")
    await init_db()
    logger.info("✅ Database tables created/verified")

    # Pre-warm MediaPipe (lazy init on first request, but log it)
    logger.info("🧠 MediaPipe Face Mesh will initialize on first request")

    yield

    logger.info("👋 Shutting down Proof-of-Life backend")


app = FastAPI(
    title="Proof-of-Life Authentication API",
    description=(
        "Real-time liveness detection using MediaPipe + OpenCV. "
        "Verifies human presence through randomized visual challenges "
        "and issues short-lived access tokens."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

# CORS – allow Railway subdomains + local dev
cors_origins = [
    settings.FRONTEND_URL.rstrip("/"),
    "http://localhost:3000",
    "http://localhost:3001",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_origin_regex=r"https://.*\.up\.railway\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routes
app.include_router(router)


@app.get("/")
async def root():
    return {
        "app": "Proof-of-Life Authentication System",
        "version": "1.0.0",
        "docs": "/docs",
        "endpoints": {
            "challenge": "POST /api/challenge",
            "verify": "POST /api/verify",
            "protected": "GET /api/protected",
            "attack_sim": "POST /api/attack-sim",
            "health": "GET /api/health",
        },
    }
