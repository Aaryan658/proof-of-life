"""Computer-vision pipeline for liveness detection using MediaPipe Face Mesh.

Detects: blink (EAR), smile (lip ratio), head turn left/right (nose offset), brow raise, mouth open.
Enforces temporal ordering of challenge steps across sequential frames.
"""

import base64
import logging
import math
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

# Explicit sub-module imports so Railway's venv resolves them correctly
import mediapipe.python.solutions.face_mesh as mp_face_mesh

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ──────────────────────────── MediaPipe Setup ────────────────────────────

_face_mesh = None


def get_face_mesh():
    """Lazy singleton for MediaPipe Face Mesh."""
    global _face_mesh
    if _face_mesh is None:
        _face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
    return _face_mesh


# ──────────────────────── Landmark helpers ────────────────────────────

# Indices from the canonical 478-point Face Mesh
LEFT_EYE_IDX = [33, 160, 158, 133, 153, 144]
RIGHT_EYE_IDX = [362, 385, 387, 263, 373, 380]
UPPER_LIP_IDX = [13]
LOWER_LIP_IDX = [14]
LEFT_LIP_IDX = [61]
RIGHT_LIP_IDX = [291]
NOSE_TIP_IDX = 1

# Brow raise landmarks (Mid-brow vs Mid-eye)
LEFT_BROW_IDX = 105
RIGHT_BROW_IDX = 334
LEFT_EYE_TOP_IDX = 159
RIGHT_EYE_TOP_IDX = 386

# Eye width for normalization
LEFT_EYE_WIDTH_IDX1 = 33
LEFT_EYE_WIDTH_IDX2 = 133


def _dist(a, b):
    return math.hypot(a.x - b.x, a.y - b.y)


def _ear(lm, indices):
    """Eye Aspect Ratio – low value ≈ eye closed."""
    p = [lm[i] for i in indices]
    v1 = _dist(p[1], p[5])
    v2 = _dist(p[2], p[4])
    h = _dist(p[0], p[3])
    return (v1 + v2) / (2.0 * h + 1e-6)


def _smile_ratio(lm):
    """Width / height of mouth – high value ≈ smiling."""
    w = _dist(lm[LEFT_LIP_IDX[0]], lm[RIGHT_LIP_IDX[0]])
    h = _dist(lm[UPPER_LIP_IDX[0]], lm[LOWER_LIP_IDX[0]])
    return w / (h + 1e-6)


def _mouth_open_ratio(lm):
    """Height / Width of mouth – high value ≈ mouth open."""
    w = _dist(lm[LEFT_LIP_IDX[0]], lm[RIGHT_LIP_IDX[0]])
    h = _dist(lm[UPPER_LIP_IDX[0]], lm[LOWER_LIP_IDX[0]])
    return h / (w + 1e-6)


def _brow_raise_ratio(lm):
    """Distance between brow and eye, normalized by eye width."""
    left_dist = _dist(lm[LEFT_BROW_IDX], lm[LEFT_EYE_TOP_IDX])
    right_dist = _dist(lm[RIGHT_BROW_IDX], lm[RIGHT_EYE_TOP_IDX])
    eye_width = _dist(lm[LEFT_EYE_WIDTH_IDX1], lm[LEFT_EYE_WIDTH_IDX2])
    return (left_dist + right_dist) / (2.0 * eye_width + 1e-6)


def _nose_offset(lm):
    """Normalised horizontal nose position (0 = far left, 1 = far right)."""
    return lm[NOSE_TIP_IDX].x


# ────────────────────────── Frame decode ─────────────────────────────

def decode_frame(base64_str: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded image to an OpenCV frame, downscaled for speed."""
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]

        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        h, w = frame.shape[:2]
        target_w = settings.FRAME_WIDTH
        if w > target_w:
            scale = target_w / w
            frame = cv2.resize(frame, (target_w, int(h * scale)))

        return frame
    except Exception as e:
        logger.warning(f"Frame decode failed: {e}")
        return None


# ────────────────────────── Action detection ─────────────────────────

def detect_action(landmarks, action: str) -> tuple:
    """Return (detected: bool, confidence: float) for a given action."""
    lm = landmarks

    if action == "blink":
        left_ear = _ear(lm, LEFT_EYE_IDX)
        right_ear = _ear(lm, RIGHT_EYE_IDX)
        avg_ear = (left_ear + right_ear) / 2.0
        threshold = getattr(settings, "BLINK_THRESHOLD", 0.21)
        detected = avg_ear < threshold
        confidence = max(0.0, 1.0 - avg_ear / threshold) if detected else 0.0
        return detected, round(confidence, 3)

    if action == "smile":
        ratio = _smile_ratio(lm)
        threshold = getattr(settings, "SMILE_THRESHOLD", 4.0)
        detected = ratio > threshold
        confidence = min(1.0, ratio / (threshold * 1.5)) if detected else 0.0
        return detected, round(confidence, 3)

    if action == "turn_left":
        nx = _nose_offset(lm)
        threshold = getattr(settings, "HEAD_TURN_THRESHOLD", 0.58)
        detected = nx > threshold
        confidence = min(1.0, (nx - 0.5) * 4) if detected else 0.0
        return detected, round(max(confidence, 0.0), 3)

    if action == "turn_right":
        nx = _nose_offset(lm)
        threshold = 1.0 - getattr(settings, "HEAD_TURN_THRESHOLD", 0.58)
        detected = nx < threshold
        confidence = min(1.0, (0.5 - nx) * 4) if detected else 0.0
        return detected, round(max(confidence, 0.0), 3)

    if action == "brow_raise":
        ratio = _brow_raise_ratio(lm)
        # Threshold: > 0.35 usually indicates raised brows
        threshold = 0.35
        detected = ratio > threshold
        confidence = min(1.0, ratio / (threshold * 1.4)) if detected else 0.0
        return detected, round(confidence, 3)

    if action == "tongue_out":
        # Proxy: Mouth Open Wide
        ratio = _mouth_open_ratio(lm)
        # Threshold: > 0.5 indicates significant vertical opening
        threshold = 0.5
        detected = ratio > threshold
        confidence = min(1.0, ratio / (threshold * 1.5)) if detected else 0.0
        return detected, round(confidence, 3)

    return False, 0.0


# ──────────────────────── Main Analysis Pipeline ────────────────────────

def analyze_frames(
    base64_frames: List[str],
    challenge_steps: List[str],
) -> Dict[str, Any]:
    """Analyse a sequence of frames against ordered challenge steps.

    Returns dict with: passed, liveness_score, step_results,
    face_detected_count, total_frames, temporal_valid.
    """
    total_frames = len(base64_frames)
    if total_frames == 0:
        return _fail("No frames provided")

    mesh = get_face_mesh()
    current_step_idx = 0
    face_detected_count = 0
    consec = 0

    step_results = [
        {"step": s, "detected": False, "confidence": 0.0, "frame_idx": -1}
        for s in challenge_steps
    ]

    for frame_idx, b64 in enumerate(base64_frames):
        if current_step_idx >= len(challenge_steps):
            break

        frame = decode_frame(b64)
        if frame is None:
            continue

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        result = mesh.process(rgb)

        if not result.multi_face_landmarks:
            consec = 0
            continue

        face_detected_count += 1
        lm = result.multi_face_landmarks[0].landmark

        detected, confidence = detect_action(lm, challenge_steps[current_step_idx])

        if detected:
            consec += 1
            min_frames = getattr(settings, "MIN_CONSECUTIVE_FRAMES", 2)
            if consec >= min_frames:
                step_results[current_step_idx]["detected"] = True
                step_results[current_step_idx]["confidence"] = confidence
                step_results[current_step_idx]["frame_idx"] = frame_idx
                current_step_idx += 1
                consec = 0
        else:
            consec = 0

    steps_passed = sum(1 for s in step_results if s["detected"])
    total_steps = len(challenge_steps)

    temporal_valid = all(
        step_results[i]["frame_idx"] < step_results[i + 1]["frame_idx"]
        for i in range(steps_passed - 1)
        if step_results[i]["detected"] and step_results[i + 1]["detected"]
    ) if steps_passed > 1 else steps_passed > 0

    step_score = (steps_passed / total_steps) * 60 if total_steps else 0
    face_ratio = (face_detected_count / total_frames) * 20
    avg_conf = (
        sum(s["confidence"] for s in step_results if s["detected"])
        / max(steps_passed, 1)
    ) * 20
    liveness_score = round(min(100.0, step_score + face_ratio + avg_conf), 1)

    passed = steps_passed == total_steps and temporal_valid and liveness_score >= 60.0

    return {
        "passed": passed,
        "liveness_score": liveness_score,
        "step_results": step_results,
        "face_detected_count": face_detected_count,
        "total_frames": total_frames,
        "temporal_valid": temporal_valid,
    }


def _fail(reason: str) -> Dict[str, Any]:
    return {
        "passed": False,
        "liveness_score": 0.0,
        "step_results": [],
        "face_detected_count": 0,
        "total_frames": 0,
        "temporal_valid": False,
        "error": reason,
    }
