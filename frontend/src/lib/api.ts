/**
 * API client for the Proof-of-Life backend.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ChallengeResponse {
    challenge_id: string;
    steps: string[];
    expires_at: string;
    expires_in_seconds: number;
}

export interface StepResult {
    step: string;
    detected: boolean;
    confidence: number;
    frame_idx: number;
}

export interface VerifyResponse {
    passed: boolean;
    liveness_score: number;
    step_results: StepResult[];
    face_detected_count: number;
    total_frames: number;
    temporal_valid: boolean;
    token?: string;
    token_expires_at?: string;
    error?: string;
}

export interface ProtectedResponse {
    message: string;
    user: string;
    token_issued_at: string;
    token_expires_at: string;
    access_level: string;
}

export interface AttackSimResponse {
    passed: boolean;
    liveness_score: number;
    rejection_reason: string;
    step_results: StepResult[];
    recommendation: string;
}

export async function getChallenge(): Promise<ChallengeResponse> {
    const res = await fetch(`${API_BASE}/api/challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Failed to generate challenge" }));
        throw new Error(err.detail || "Failed to generate challenge");
    }
    return res.json();
}

export async function submitVerification(
    challengeId: string,
    frames: string[]
): Promise<VerifyResponse> {
    const res = await fetch(`${API_BASE}/api/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            challenge_id: challengeId,
            frames,
        }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Verification failed" }));
        throw new Error(err.detail || "Verification failed");
    }
    return res.json();
}

export async function accessProtected(token: string): Promise<ProtectedResponse> {
    const res = await fetch(`${API_BASE}/api/protected`, {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Access denied" }));
        throw new Error(err.detail || "Access denied");
    }
    return res.json();
}

export async function runAttackSim(frames: string[]): Promise<AttackSimResponse> {
    const res = await fetch(`${API_BASE}/api/attack-sim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frames }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Attack sim failed" }));
        throw new Error(err.detail || "Attack sim failed");
    }
    return res.json();
}
