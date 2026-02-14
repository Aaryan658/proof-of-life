"""Computer Vision pipeline for liveness detection using MediaPipe Face Mesh.

Detects: blink (EAR), smile (MAR), head turn left/right (nose offset).
Enforces temporal ordering of challenge steps across sequential frames.
"""

import base64
import logging
from typing import List, Dict, Any, Optional

import cv2
import mediapipe as mp
import numpy as np

from app.core.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# ──────────────────────────── MediaPipe Setup ────────────────────────────

_face_mesh: Optional[mp.solutions.face_mesh.FaceMesh] = None


def get_face_mesh():
    """Lazy singleton for MediaPipe Face Mesh."""
    global _face_mesh
    if _face_mesh is None:
        _face_mesh = mp.solutions.face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            refine_landmarks=True,
            min_detection_confidence=0.5,
        )
    return _face_mesh


# ──────────────────────── Landmark Indices ───────────────────────────────

# Eye landmarks for EAR calculation (right eye)
RIGHT_EYE_IDX = [33, 160, 158, 133, 153, 144]
# Eye landmarks for EAR calculation (left eye)
LEFT_EYE_IDX = [362, 385, 387, 263, 373, 380]

# Mouth landmarks for MAR calculation
UPPER_LIP = [13]
LOWER_LIP = [14]
LEFT_MOUTH = [61]
RIGHT_MOUTH = [291]
UPPER_OUTER_LIP = [82]
LOWER_OUTER_LIP = [87]

# Nose and face boundary for head pose
NOSE_TIP = 1
LEFT_FACE = 234
RIGHT_FACE = 454


# ──────────────────────── Detection Functions ────────────────────────────

def _distance(p1, p2) -> float:
    """Euclidean distance between two landmark points."""
    return np.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2)


def compute_ear(landmarks) -> float:
    """Compute Eye Aspect Ratio (average of both eyes).
    
    EAR = (|p2-p6| + |p3-p5|) / (2 * |p1-p4|) for each eye.
    Low EAR indicates a blink.
    """
    def _ear_single(eye_idx):
        p = [landmarks[i] for i in eye_idx]
        vertical_1 = _distance(p[1], p[5])
        vertical_2 = _distance(p[2], p[4])
        horizontal = _distance(p[0], p[3])
        if horizontal < 1e-6:
            return 0.3  # Fallback
        return (vertical_1 + vertical_2) / (2.0 * horizontal)

    left_ear = _ear_single(LEFT_EYE_IDX)
    right_ear = _ear_single(RIGHT_EYE_IDX)
    return (left_ear + right_ear) / 2.0


def compute_mar(landmarks) -> float:
    """Compute Mouth Aspect Ratio.
    
    MAR = vertical_distance / horizontal_distance.
    High MAR indicates a smile/open mouth.
    """
    upper = landmarks[UPPER_OUTER_LIP[0]]
    lower = landmarks[LOWER_OUTER_LIP[0]]
    left = landmarks[LEFT_MOUTH[0]]
    right = landmarks[RIGHT_MOUTH[0]]

    vertical = _distance(upper, lower)
    horizontal = _distance(left, right)

    if horizontal < 1e-6:
        return 0.0
    return vertical / horizontal


def compute_head_turn(landmarks) -> float:
    """Compute normalized head turn ratio.
    
    Returns: ratio where negative = turned left, positive = turned right.
    Based on nose tip position relative to face center.
    """
    nose = landmarks[NOSE_TIP]
    left_face = landmarks[LEFT_FACE]
    right_face = landmarks[RIGHT_FACE]

    face_width = right_face.x - left_face.x
    if face_width < 1e-6:
        return 0.0

    face_center_x = (left_face.x + right_face.x) / 2.0
    offset = (nose.x - face_center_x) / face_width
    return offset


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


def extract_landmarks(frame: np.ndarray):
    """Extract face mesh landmarks from a frame. Returns None if no face found."""
    face_mesh = get_face_mesh()
    rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
    result = face_mesh.process(rgb)

    if not result.multi_face_landmarks:
        return None

    return result.multi_face_landmarks[0].landmark


def detect_action(landmarks, action: str) -> tuple[bool, float]:
    """Detect whether a specific action is being performed.
    
    Returns: (detected: bool, confidence: float 0-1)
    """
    if action == "blink":
        ear = compute_ear(landmarks)
        detected = ear < settings.EAR_THRESHOLD
        # Confidence: how far below threshold
        if detected:
            confidence = min(1.0, (settings.EAR_THRESHOLD - ear) / settings.EAR_THRESHOLD)
        else:
            confidence = max(0.0, 1.0 - (ear - settings.EAR_THRESHOLD) / 0.1)
        return detected, confidence

    elif action == "smile":
        mar = compute_mar(landmarks)
        detected = mar > settings.MAR_THRESHOLD
        if detected:
            confidence = min(1.0, (mar - settings.MAR_THRESHOLD) / 0.3)
        else:
            confidence = max(0.0, mar / settings.MAR_THRESHOLD)
        return detected, confidence

    elif action == "turn_left":
        ratio = compute_head_turn(landmarks)
        detected = ratio < -settings.HEAD_TURN_THRESHOLD
        if detected:
            confidence = min(1.0, abs(ratio) / (settings.HEAD_TURN_THRESHOLD * 3))
        else:
            confidence = 0.0
        return detected, confidence

    elif action == "turn_right":
        ratio = compute_head_turn(landmarks)
        detected = ratio > settings.HEAD_TURN_THRESHOLD
        if detected:
            confidence = min(1.0, abs(ratio) / (settings.HEAD_TURN_THRESHOLD * 3))
        else:
            confidence = 0.0
        return detected, confidence

    return False, 0.0


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

        landmarks = extract_landmarks(frame)
        if landmarks is None:
            consecutive_detection_count = 0
            continue

        face_detected_count += 1

        # Check current step
        current_step = challenge_steps[current_step_idx]
        detected, confidence = detect_action(landmarks, current_step)

        if detected:
            consecutive_detection_count += 1
            if consecutive_detection_count >= settings.MIN_CONSECUTIVE_FRAMES:
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

    # Temporal validity: steps must be detected in order (enforced by sequential scanning)
    temporal_valid = all(
        step_results[i]["frame_idx"] < step_results[i + 1]["frame_idx"]
        for i in range(steps_passed - 1)
        if step_results[i]["detected"] and step_results[i + 1]["detected"]
    ) if steps_passed > 1 else steps_passed > 0

    # Liveness score computation
    step_score = (steps_passed / total_steps) * 60  # 60% from step completion
    face_ratio = (face_detected_count / total_frames) * 20 if total_frames > 0 else 0  # 20% from face presence
    avg_confidence = (
        sum(s["confidence"] for s in step_results if s["detected"]) / max(steps_passed, 1)
    ) * 20  # 20% from confidence

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
