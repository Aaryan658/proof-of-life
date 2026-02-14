"""Computer Vision pipeline for liveness detection using pure OpenCV.

Detects: blink (eye aspect ratio via Haar cascades), smile (mouth cascade),
head turn left/right (face position offset).
Enforces temporal ordering of challenge steps across sequential frames.

Uses OpenCV's pre-trained Haar cascades and DNN face detector for
maximum deployment compatibility (no mediapipe dependency).
"""

import base64
import logging
import os
from typing import List, Dict, Any, Optional

import cv2
import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ──────────────────────────── OpenCV Setup ────────────────────────────

# Haar cascade paths (bundled with opencv-python-headless)
_CASCADE_DIR = os.path.join(
    os.path.dirname(cv2.__file__), "data"
)

_face_cascade: Optional[cv2.CascadeClassifier] = None
_eye_cascade: Optional[cv2.CascadeClassifier] = None
_smile_cascade: Optional[cv2.CascadeClassifier] = None


def _get_face_cascade() -> cv2.CascadeClassifier:
    global _face_cascade
    if _face_cascade is None:
        path = os.path.join(_CASCADE_DIR, "haarcascade_frontalface_default.xml")
        _face_cascade = cv2.CascadeClassifier(path)
        if _face_cascade.empty():
            logger.error(f"Failed to load face cascade from {path}")
    return _face_cascade


def _get_eye_cascade() -> cv2.CascadeClassifier:
    global _eye_cascade
    if _eye_cascade is None:
        path = os.path.join(_CASCADE_DIR, "haarcascade_eye.xml")
        _eye_cascade = cv2.CascadeClassifier(path)
        if _eye_cascade.empty():
            logger.error(f"Failed to load eye cascade from {path}")
    return _eye_cascade


def _get_smile_cascade() -> cv2.CascadeClassifier:
    global _smile_cascade
    if _smile_cascade is None:
        path = os.path.join(_CASCADE_DIR, "haarcascade_smile.xml")
        _smile_cascade = cv2.CascadeClassifier(path)
        if _smile_cascade.empty():
            logger.error(f"Failed to load smile cascade from {path}")
    return _smile_cascade


# ──────────────────────── Detection Functions ────────────────────────────

def _detect_face(gray: np.ndarray) -> Optional[tuple]:
    """Detect the largest face in the frame. Returns (x, y, w, h) or None."""
    cascade = _get_face_cascade()
    faces = cascade.detectMultiScale(
        gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60)
    )
    if len(faces) == 0:
        return None
    # Return largest face
    return max(faces, key=lambda f: f[2] * f[3])


def _detect_blink(gray: np.ndarray, face_rect: tuple) -> tuple[bool, float]:
    """Detect blink by checking if eyes are NOT visible (closed).
    
    When eyes are closed, the eye cascade won't detect them.
    Returns (is_blinking, confidence).
    """
    x, y, w, h = face_rect
    # Focus on upper half of face (eye region)
    eye_region = gray[y:y + h // 2, x:x + w]
    
    if eye_region.size == 0:
        return False, 0.0
    
    cascade = _get_eye_cascade()
    eyes = cascade.detectMultiScale(
        eye_region, scaleFactor=1.1, minNeighbors=5, minSize=(20, 20)
    )
    
    # No eyes detected = likely blinking
    num_eyes = len(eyes)
    if num_eyes == 0:
        return True, 0.85
    elif num_eyes == 1:
        return True, 0.5  # Partial blink or one eye closed
    else:
        return False, 0.1


def _detect_smile(gray: np.ndarray, face_rect: tuple) -> tuple[bool, float]:
    """Detect smile using mouth/smile cascade on lower face region.
    
    Returns (is_smiling, confidence).
    """
    x, y, w, h = face_rect
    # Focus on lower third of face (mouth region)
    mouth_region = gray[y + 2 * h // 3:y + h, x:x + w]
    
    if mouth_region.size == 0:
        return False, 0.0
    
    cascade = _get_smile_cascade()
    smiles = cascade.detectMultiScale(
        mouth_region, scaleFactor=1.7, minNeighbors=22, minSize=(25, 15)
    )
    
    if len(smiles) > 0:
        # Confidence based on how many smile detections
        confidence = min(1.0, 0.5 + len(smiles) * 0.2)
        return True, confidence
    
    return False, 0.0


def _detect_head_turn(gray: np.ndarray, face_rect: tuple, 
                       frame_width: int) -> tuple[float, float]:
    """Detect head turn direction based on face position in frame.
    
    Returns (turn_ratio, confidence) where:
    - negative ratio = face is to the left (turned left)
    - positive ratio = face is to the right (turned right)
    """
    x, y, w, h = face_rect
    face_center_x = x + w / 2
    frame_center_x = frame_width / 2
    
    # Normalized offset: -1.0 (far left) to +1.0 (far right)
    offset = (face_center_x - frame_center_x) / (frame_width / 2)
    
    return offset, abs(offset)


def detect_action(gray: np.ndarray, face_rect: tuple, 
                  frame_width: int, action: str) -> tuple[bool, float]:
    """Detect whether a specific action is being performed.
    
    Returns: (detected: bool, confidence: float 0-1)
    """
    if action == "blink":
        return _detect_blink(gray, face_rect)
    
    elif action == "smile":
        return _detect_smile(gray, face_rect)
    
    elif action == "turn_left":
        offset, confidence = _detect_head_turn(gray, face_rect, frame_width)
        # Face moved to the right side of frame = person turned head left
        threshold = getattr(settings, 'HEAD_TURN_THRESHOLD', 0.15)
        detected = offset > threshold
        return detected, confidence if detected else 0.0
    
    elif action == "turn_right":
        offset, confidence = _detect_head_turn(gray, face_rect, frame_width)
        # Face moved to the left side of frame = person turned head right
        threshold = getattr(settings, 'HEAD_TURN_THRESHOLD', 0.15)
        detected = offset < -threshold
        return detected, confidence if detected else 0.0
    
    return False, 0.0


# ──────────────────────── Frame Processing ────────────────────────────

def decode_frame(base64_str: str) -> Optional[np.ndarray]:
    """Decode a base64-encoded image to an OpenCV frame, downscaled for speed."""
    try:
        # Remove data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]

        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if frame is None:
            return None

        # Downscale for speed
        h, w = frame.shape[:2]
        target_w = settings.FRAME_WIDTH
        if w > target_w:
            scale = target_w / w
            frame = cv2.resize(frame, (target_w, int(h * scale)))

        return frame
    except Exception as e:
        logger.warning(f"Frame decode failed: {e}")
        return None


# ──────────────────────── Main Analysis Pipeline ────────────────────────

def analyze_frames(
    base64_frames: List[str],
    challenge_steps: List[str],
) -> Dict[str, Any]:
    """Analyze a sequence of frames against challenge steps.
    
    Enforces temporal ordering: step N must be detected in frames
    AFTER step N-1 was detected.
    
    Returns:
        {
            "passed": bool,
            "liveness_score": float (0-100),
            "step_results": [{"step": str, "detected": bool, "confidence": float, "frame_idx": int}],
            "face_detected_count": int,
            "total_frames": int,
            "temporal_valid": bool,
        }
    """
    total_frames = len(base64_frames)
    if total_frames == 0:
        return {
            "passed": False,
            "liveness_score": 0.0,
            "step_results": [],
            "face_detected_count": 0,
            "total_frames": 0,
            "temporal_valid": False,
            "error": "No frames provided",
        }

    # Track which step we're currently looking for
    current_step_idx = 0
    step_results = []
    face_detected_count = 0
    consecutive_detection_count = 0

    # Initialize step results
    for step in challenge_steps:
        step_results.append({
            "step": step,
            "detected": False,
            "confidence": 0.0,
            "frame_idx": -1,
        })

    # Process each frame
    for frame_idx, b64_frame in enumerate(base64_frames):
        # Early exit if all steps verified
        if current_step_idx >= len(challenge_steps):
            break

        frame = decode_frame(b64_frame)
        if frame is None:
            continue

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        frame_height, frame_width = gray.shape[:2]

        # Detect face
        face_rect = _detect_face(gray)
        if face_rect is None:
            consecutive_detection_count = 0
            continue

        face_detected_count += 1

        # Check current step
        current_step = challenge_steps[current_step_idx]
        detected, confidence = detect_action(
            gray, face_rect, frame_width, current_step
        )

        if detected:
            consecutive_detection_count += 1
            min_frames = getattr(settings, 'MIN_CONSECUTIVE_FRAMES', 2)
            if consecutive_detection_count >= min_frames:
                step_results[current_step_idx]["detected"] = True
                step_results[current_step_idx]["confidence"] = confidence
                step_results[current_step_idx]["frame_idx"] = frame_idx
                current_step_idx += 1
                consecutive_detection_count = 0
        else:
            consecutive_detection_count = 0

    # Calculate results
    steps_passed = sum(1 for s in step_results if s["detected"])
    total_steps = len(challenge_steps)

    # Temporal validity: steps must be detected in order
    temporal_valid = all(
        step_results[i]["frame_idx"] < step_results[i + 1]["frame_idx"]
        for i in range(steps_passed - 1)
        if step_results[i]["detected"] and step_results[i + 1]["detected"]
    ) if steps_passed > 1 else steps_passed > 0

    # Liveness score computation
    step_score = (steps_passed / total_steps) * 60 if total_steps > 0 else 0
    face_ratio = (face_detected_count / total_frames) * 20 if total_frames > 0 else 0
    avg_confidence = (
        sum(s["confidence"] for s in step_results if s["detected"]) / max(steps_passed, 1)
    ) * 20

    liveness_score = round(min(100.0, step_score + face_ratio + avg_confidence), 1)

    passed = steps_passed == total_steps and temporal_valid and liveness_score >= 60.0

    return {
        "passed": passed,
        "liveness_score": liveness_score,
        "step_results": step_results,
        "face_detected_count": face_detected_count,
        "total_frames": total_frames,
        "temporal_valid": temporal_valid,
    }
