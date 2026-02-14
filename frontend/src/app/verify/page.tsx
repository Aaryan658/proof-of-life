"use client";

import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    Shield, ArrowLeft, AlertTriangle, CheckCircle2,
    XCircle, Loader2, Lock, RefreshCw
} from "lucide-react";

import WebcamFeed from "@/components/webcam-feed";
import LivenessMeter from "@/components/liveness-meter";
import ChallengeDisplay from "@/components/challenge-display";
import TokenCountdown from "@/components/token-countdown";
import {
    getChallenge,
    submitVerification,
    type ChallengeResponse,
    type VerifyResponse,
} from "@/lib/api";

type AppState = "idle" | "loading" | "challenge" | "capturing" | "analyzing" | "success" | "failure" | "error";

export default function VerifyPage() {
    const router = useRouter();
    const [state, setState] = useState<AppState>("idle");
    const [challenge, setChallenge] = useState<ChallengeResponse | null>(null);
    const [result, setResult] = useState<VerifyResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
    const [challengeTimer, setChallengeTimer] = useState(0);
    const framesRef = useRef<string[]>([]);
    const captureTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Step 1: Request a challenge from the backend
    const startChallenge = useCallback(async () => {
        try {
            setState("loading");
            setError(null);
            setResult(null);
            setCapturedFrames([]);
            framesRef.current = [];

            const ch = await getChallenge();
            setChallenge(ch);
            setChallengeTimer(ch.expires_in_seconds);
            setState("challenge");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to generate challenge");
            setState("error");
        }
    }, []);

    // Step 2: Start capturing frames
    const startCapture = useCallback(() => {
        setState("capturing");
        framesRef.current = [];

        // Auto-stop capture after 8 seconds
        captureTimerRef.current = setTimeout(() => {
            submitFrames();
        }, 8000);
    }, []);

    // Step 3: Collect frames from webcam feed
    const handleFrame = useCallback((base64: string) => {
        if (framesRef.current.length < 30) {
            framesRef.current.push(base64);
            setCapturedFrames([...framesRef.current]);
        } else {
            // Auto-submit when we have enough frames
            if (captureTimerRef.current) {
                clearTimeout(captureTimerRef.current);
            }
            submitFrames();
        }
    }, []);

    // Step 4: Send frames to backend for verification
    const submitFrames = useCallback(async () => {
        if (captureTimerRef.current) {
            clearTimeout(captureTimerRef.current);
        }

        const frames = framesRef.current;
        if (frames.length === 0 || !challenge) {
            setError("No frames captured. Please try again.");
            setState("error");
            return;
        }

        setState("analyzing");

        try {
            const res = await submitVerification(challenge.challenge_id, frames);
            setResult(res);
            setState(res.passed ? "success" : "failure");

            // Store token in sessionStorage on success
            if (res.passed && res.token) {
                sessionStorage.setItem("pol_token", res.token);
                sessionStorage.setItem("pol_token_expires", res.token_expires_at || "");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Verification request failed");
            setState("error");
        }
    }, [challenge]);

    // Challenge steps with detection status from result
    const challengeSteps = challenge
        ? challenge.steps.map((step, idx) => ({
            step,
            detected: result?.step_results?.[idx]?.detected || false,
            confidence: result?.step_results?.[idx]?.confidence || 0,
        }))
        : [];

    const currentStepIndex = result
        ? challengeSteps.filter((s) => s.detected).length
        : 0;

    const challengeStatus = state === "success"
        ? "complete" as const
        : state === "failure"
            ? "failed" as const
            : ["capturing", "analyzing"].includes(state)
                ? "active" as const
                : "idle" as const;

    return (
        <div className="min-h-screen bg-[var(--background)] bg-grid relative">
            <div className="bg-radial-glow absolute inset-0 pointer-events-none" />

            {/* Header */}
            <motion.header
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="relative z-10 flex items-center justify-between px-6 py-4 max-w-7xl mx-auto"
            >
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-white transition-colors"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">Back</span>
                </button>
                <div className="flex items-center gap-3">
                    <Shield size={18} className="text-[var(--primary)]" />
                    <span className="font-semibold text-sm">Verification Console</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="chip chip-primary text-[10px]">
                        {state === "idle" ? "STANDBY" :
                            state === "loading" ? "LOADING" :
                                state === "challenge" ? "READY" :
                                    state === "capturing" ? "SCANNING" :
                                        state === "analyzing" ? "PROCESSING" :
                                            state === "success" ? "VERIFIED" :
                                                state === "failure" ? "REJECTED" : "ERROR"}
                    </div>
                </div>
            </motion.header>

            {/* Main content */}
            <main className="relative z-10 max-w-7xl mx-auto px-6 pb-12">
                <div className="grid lg:grid-cols-5 gap-6 mt-4">
                    {/* Left panel — Webcam (3 cols) */}
                    <div className="lg:col-span-3 space-y-5">
                        {/* Webcam */}
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.5 }}
                            className="glass-card overflow-hidden"
                        >
                            <WebcamFeed
                                isCapturing={state === "capturing"}
                                onFrame={handleFrame}
                                captureInterval={300}
                                className="w-full aspect-video"
                            />
                        </motion.div>

                        {/* Frame counter */}
                        {(state === "capturing" || state === "analyzing") && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card p-4 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 bg-[var(--primary)] rounded-full animate-pulse" />
                                    <span className="text-sm text-[var(--muted-foreground)]">
                                        Frames captured: <span className="text-white font-mono font-bold">{capturedFrames.length}</span>
                                    </span>
                                </div>
                                <div className="h-2 flex-1 mx-4 bg-[var(--muted)] rounded-full overflow-hidden max-w-xs">
                                    <motion.div
                                        className="h-full bg-gradient-to-r from-[var(--primary)] to-[var(--cyan)] rounded-full"
                                        animate={{ width: `${Math.min(100, (capturedFrames.length / 20) * 100)}%` }}
                                    />
                                </div>
                                {state === "capturing" && (
                                    <button
                                        onClick={submitFrames}
                                        className="btn-primary text-xs py-2 px-4"
                                    >
                                        Submit Now
                                    </button>
                                )}
                            </motion.div>
                        )}

                        {/* Security Indicators Bar */}
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 }}
                            className="glass-card p-4 flex flex-wrap items-center justify-around gap-4"
                        >
                            <div className="text-center">
                                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                                    Replay Protection
                                </div>
                                <div className={`chip ${challenge && !challenge ? "chip-danger" : "chip-success"} text-[10px]`}>
                                    <Lock size={10} />
                                    {challenge ? "ONE-TIME ID" : "PENDING"}
                                </div>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                                    Challenge Expiry
                                </div>
                                <span className="font-mono text-sm font-bold text-[var(--cyan)]">
                                    {challenge ? `${Math.max(0, challengeTimer)}s` : "—"}
                                </span>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                                    Face Mesh
                                </div>
                                <span className="font-mono text-sm font-bold text-[var(--primary)]">468 pts</span>
                            </div>
                            <div className="text-center">
                                <div className="text-[10px] text-[var(--muted-foreground)] uppercase tracking-widest mb-1">
                                    Pipeline
                                </div>
                                <div className="chip chip-primary text-[10px]">
                                    <Loader2 size={10} className={state === "analyzing" ? "animate-spin" : ""} />
                                    {state === "analyzing" ? "ACTIVE" : "IDLE"}
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Right panel — Challenge + Results (2 cols) */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Main action area */}
                        <AnimatePresence mode="wait">
                            {/* IDLE state */}
                            {state === "idle" && (
                                <motion.div
                                    key="idle"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="glass-card p-8 text-center"
                                >
                                    <div className="w-16 h-16 rounded-2xl bg-[rgba(99,102,241,0.15)] flex items-center justify-center mx-auto mb-5">
                                        <Shield size={32} className="text-[var(--primary)]" />
                                    </div>
                                    <h2 className="text-xl font-bold mb-3">Identity Verification</h2>
                                    <p className="text-sm text-[var(--muted-foreground)] mb-6 leading-relaxed">
                                        You&apos;ll receive a random sequence of gestures to perform.
                                        Our CV pipeline will analyze your response in real-time.
                                    </p>
                                    <button onClick={startChallenge} className="btn-primary w-full py-4 text-base">
                                        Generate Challenge
                                    </button>
                                </motion.div>
                            )}

                            {/* LOADING state */}
                            {state === "loading" && (
                                <motion.div
                                    key="loading"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="glass-card p-8 text-center"
                                >
                                    <Loader2 size={40} className="text-[var(--primary)] animate-spin mx-auto mb-4" />
                                    <p className="text-sm text-[var(--muted-foreground)]">Generating your personalized challenge...</p>
                                </motion.div>
                            )}

                            {/* CHALLENGE state */}
                            {state === "challenge" && challenge && (
                                <motion.div
                                    key="challenge"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="glass-card p-6"
                                >
                                    <ChallengeDisplay
                                        steps={challengeSteps}
                                        currentStepIndex={0}
                                        status="idle"
                                    />
                                    <div className="mt-6 p-4 rounded-xl bg-[rgba(245,158,11,0.08)] border border-[rgba(245,158,11,0.2)]">
                                        <div className="flex items-start gap-3">
                                            <AlertTriangle size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-medium text-[var(--warning)]">Instructions</p>
                                                <p className="text-xs text-[var(--muted-foreground)] mt-1">
                                                    Perform each gesture in order when prompted. Keep your face centered and well-lit.
                                                    You have {challenge.expires_in_seconds}s before the challenge expires.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button onClick={startCapture} className="btn-primary w-full mt-5 py-3">
                                        Start Capture
                                    </button>
                                </motion.div>
                            )}

                            {/* CAPTURING state */}
                            {state === "capturing" && challenge && (
                                <motion.div
                                    key="capturing"
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="glass-card p-6"
                                >
                                    <ChallengeDisplay
                                        steps={challengeSteps}
                                        currentStepIndex={currentStepIndex}
                                        status="active"
                                    />
                                    <div className="mt-5 p-4 rounded-xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.2)]">
                                        <p className="text-sm text-[var(--primary)] text-center font-medium animate-pulse">
                                            Perform each gesture now — looking at the camera
                                        </p>
                                    </div>
                                </motion.div>
                            )}

                            {/* ANALYZING state */}
                            {state === "analyzing" && (
                                <motion.div
                                    key="analyzing"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="glass-card p-8 text-center"
                                >
                                    <div className="relative w-20 h-20 mx-auto mb-5">
                                        <div className="absolute inset-0 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                                        <div className="absolute inset-2 border-4 border-[var(--cyan)] border-b-transparent rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
                                        <div className="absolute inset-4 border-4 border-[var(--success)] border-t-transparent rounded-full animate-spin" style={{ animationDuration: "2s" }} />
                                    </div>
                                    <h3 className="font-semibold mb-2">Analyzing Liveness</h3>
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                        Processing {capturedFrames.length} frames through CV pipeline...
                                    </p>
                                </motion.div>
                            )}

                            {/* SUCCESS state */}
                            {state === "success" && result && (
                                <motion.div
                                    key="success"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-5"
                                >
                                    <div className="glass-card p-6 text-center glow-success">
                                        <CheckCircle2 size={48} className="text-[var(--success)] mx-auto mb-3" />
                                        <h3 className="text-xl font-bold text-[var(--success)]">Verification Passed</h3>
                                        <p className="text-sm text-[var(--muted-foreground)] mt-2">
                                            You are a verified live human.
                                        </p>
                                    </div>

                                    <div className="glass-card p-6">
                                        <LivenessMeter score={result.liveness_score} />
                                    </div>

                                    <div className="glass-card p-6">
                                        <ChallengeDisplay
                                            steps={challengeSteps}
                                            currentStepIndex={challengeSteps.length}
                                            status="complete"
                                        />
                                    </div>

                                    {result.token_expires_at && (
                                        <div className="glass-card p-6">
                                            <TokenCountdown expiresAt={result.token_expires_at} />
                                        </div>
                                    )}

                                    <button
                                        onClick={() => router.push("/protected")}
                                        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                                    >
                                        <Lock size={18} />
                                        Access Protected Resource
                                    </button>
                                </motion.div>
                            )}

                            {/* FAILURE state */}
                            {state === "failure" && result && (
                                <motion.div
                                    key="failure"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-5"
                                >
                                    <div className="glass-card p-6 text-center glow-danger">
                                        <XCircle size={48} className="text-[var(--danger)] mx-auto mb-3" />
                                        <h3 className="text-xl font-bold text-[var(--danger)]">Verification Failed</h3>
                                        <p className="text-sm text-[var(--muted-foreground)] mt-2">
                                            Liveness could not be confirmed.
                                        </p>
                                    </div>

                                    <div className="glass-card p-6">
                                        <LivenessMeter score={result.liveness_score} />
                                    </div>

                                    <div className="glass-card p-6">
                                        <ChallengeDisplay
                                            steps={challengeSteps}
                                            currentStepIndex={currentStepIndex}
                                            status="failed"
                                        />
                                    </div>

                                    <button
                                        onClick={() => { setState("idle"); setChallenge(null); setResult(null); }}
                                        className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                                    >
                                        <RefreshCw size={18} />
                                        Try Again
                                    </button>
                                </motion.div>
                            )}

                            {/* ERROR state */}
                            {state === "error" && (
                                <motion.div
                                    key="error"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="glass-card p-6 text-center"
                                >
                                    <AlertTriangle size={48} className="text-[var(--warning)] mx-auto mb-3" />
                                    <h3 className="text-lg font-bold mb-2">Something Went Wrong</h3>
                                    <p className="text-sm text-[var(--muted-foreground)] mb-5">{error}</p>
                                    <button
                                        onClick={() => { setState("idle"); setError(null); }}
                                        className="btn-outline"
                                    >
                                        Try Again
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>
        </div>
    );
}
