# 🛡️ Proof of Life — Anti-Deepfake Identity Verification

Real-time liveness detection system using computer vision to verify human presence through randomized visual challenges. Built with **Next.js**, **FastAPI**, **MediaPipe**, and **PostgreSQL**.

![Tech Stack](https://img.shields.io/badge/Next.js-black?logo=next.js) ![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white) ![MediaPipe](https://img.shields.io/badge/MediaPipe-FF6F00?logo=google&logoColor=white)

---

## 🏗️ Architecture

```
Frontend (Next.js)          Backend (FastAPI)          Database
┌─────────────────┐   REST  ┌────────────────────┐    ┌──────────┐
│ Landing Page     │───────▶│ POST /api/challenge  │───▶│PostgreSQL│
│ Verify Console   │◀───────│ POST /api/verify     │◀──│ Railway   │
│ Protected Page   │        │ GET  /api/protected  │    └──────────┘
│                  │        │ POST /api/attack-sim │
│ Webcam + Canvas  │        │ MediaPipe Face Mesh  │
│ Framer Motion    │        │ OpenCV (headless)    │
└─────────────────┘        └────────────────────┘
```

---

## 🚀 Local Setup (No Docker)

### Prerequisites
- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL** running locally (or use Railway-provisioned DB)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv

# Activate (Windows)
.venv\Scripts\activate
# Activate (Linux/Mac)
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
copy .env.example .env
# Edit .env with your DATABASE_URL and JWT_SECRET

# Run server
uvicorn main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
# Edit .env.local — set NEXT_PUBLIC_API_URL=http://localhost:8000

# Run dev server
npm run dev
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `postgresql+asyncpg://postgres:postgres@localhost:5432/proof_of_life` | PostgreSQL connection string |
| `JWT_SECRET` | `change-me` | Secret key for JWT signing |
| `JWT_EXPIRY_MINUTES` | `5` | Token lifetime |
| `CHALLENGE_EXPIRY_SECONDS` | `120` | Challenge timeout |
| `FRONTEND_URL` | `http://localhost:3000` | CORS allowed origin |
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend URL for frontend |

---

## 🚂 Railway Deployment (Backend + PostgreSQL)

### 1. Create Railway Project
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Initialize project from backend directory
cd backend
railway init
```

### 2. Add PostgreSQL
- In Railway dashboard → **New** → **Database** → **PostgreSQL**
- Railway auto-sets `DATABASE_URL` in environment

### 3. Configure Environment Variables
In Railway dashboard → **Variables**:
```
JWT_SECRET=<generate-a-strong-secret>
FRONTEND_URL=https://your-frontend-url.vercel.app
```

### 4. Deploy
```bash
railway up
```

Railway reads the `Procfile` and `runtime.txt` automatically:
- `Procfile`: `web: uvicorn main:app --host 0.0.0.0 --port $PORT`
- `runtime.txt`: `python-3.11.8`

### 5. Frontend Deployment (Vercel)
```bash
cd frontend
npx vercel --prod
# Set NEXT_PUBLIC_API_URL to your Railway backend URL
```

---

## 🧠 How Liveness Detection Works

### Challenge-Response Protocol
1. **Challenge Generation**: Server creates a random sequence of 3 gestures from `[blink, turn_left, turn_right, smile]`
2. **Frame Capture**: Frontend captures ~20-30 frames at 300ms intervals via `getUserMedia`
3. **CV Analysis**: Backend processes each frame through MediaPipe Face Mesh (468 landmarks)
4. **Temporal Verification**: Actions must be detected **in the correct order** across sequential frames

### Detection Methods

| Gesture | Method | Metric |
|---------|--------|--------|
| **Blink** | Eye Aspect Ratio (EAR) | `(|p2-p6| + |p3-p5|) / (2·|p1-p4|)` < 0.21 |
| **Smile** | Mouth Aspect Ratio (MAR) | `vertical / horizontal` mouth distance > 0.55 |
| **Head Turn** | Nose Offset Ratio | Nose tip X offset from face center > 3.5% face width |

### Liveness Score Composition
- **60%** — Step completion (all 3 gestures detected in order)
- **20%** — Face presence ratio (face detected in most frames)
- **20%** — Average detection confidence

---

## 🔒 Security: Replay & Spoofing Resistance

### Replay Attack Mitigation
- **One-time challenge IDs**: Each challenge can only be submitted once (`used=True` after first attempt)
- **Time-bound challenges**: Expire after 120 seconds
- **Randomized sequences**: Attackers cannot pre-record the correct gesture order

### Spoofing Resistance
- **Static images fail** because they cannot produce temporal variation across frames
- **Pre-recorded videos fail** because the gesture sequence is randomized per session
- **Temporal ordering enforcement** requires actions to appear in the correct sequence
- **Consecutive frame requirement** (≥2 frames) prevents single-frame glitches

### Token Security
- **Short-lived JWTs** (5 minutes default)
- **Hash-stored** in PostgreSQL (SHA-256) — raw tokens never persisted
- **Server-side validation** on every protected request
- **Revocation support** via DB flag

---

## 📡 API Reference

### `POST /api/challenge`
Generate a new randomized challenge.
```json
// Response
{
  "challenge_id": "uuid",
  "steps": ["blink", "turn_right", "smile"],
  "expires_at": "2026-02-14T10:00:00Z",
  "expires_in_seconds": 120
}
```

### `POST /api/verify`
Submit frames for liveness verification.
```json
// Request
{
  "challenge_id": "uuid",
  "frames": ["data:image/jpeg;base64,...", "..."]
}
// Response
{
  "passed": true,
  "liveness_score": 87.5,
  "step_results": [{"step": "blink", "detected": true, "confidence": 0.92, "frame_idx": 3}],
  "token": "eyJhbG...",
  "token_expires_at": "2026-02-14T10:05:00Z"
}
```

### `GET /api/protected`
Access protected resource (requires `Authorization: Bearer <token>`).

### `POST /api/attack-sim`
Demonstrate rejection of static images/replays.

---

## 📁 Project Structure

```
├── backend/
│   ├── main.py                    # FastAPI entry point
│   ├── Procfile                   # Railway deployment
│   ├── requirements.txt           # Python dependencies
│   ├── runtime.txt                # Python version
│   └── app/
│       ├── core/
│       │   ├── config.py          # Pydantic settings
│       │   ├── database.py        # Async SQLAlchemy
│       │   └── security.py        # JWT auth
│       ├── api/
│       │   └── routes.py          # API endpoints
│       ├── models/
│       │   └── models.py          # DB models
│       └── services/
│           ├── challenge.py       # Challenge generation
│           └── vision.py          # CV pipeline
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── page.tsx           # Landing page
│   │   │   ├── verify/page.tsx    # Verification console
│   │   │   └── protected/page.tsx # Protected resource
│   │   ├── components/
│   │   │   ├── webcam-feed.tsx    # Camera component
│   │   │   ├── liveness-meter.tsx # Score gauge
│   │   │   ├── challenge-display.tsx
│   │   │   └── token-countdown.tsx
│   │   └── lib/
│   │       ├── api.ts             # API client
│   │       └── utils.ts           # Utilities
└── README.md
```
