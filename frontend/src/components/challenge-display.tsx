"use client";

import { motion } from "framer-motion";
import { Eye, ArrowLeft, ArrowRight, Smile, CheckCircle2, Circle, Loader2 } from "lucide-react";

interface ChallengeStep {
    step: string;
    detected?: boolean;
    confidence?: number;
}

interface ChallengeDisplayProps {
    steps: ChallengeStep[];
    currentStepIndex: number;
    status: "idle" | "active" | "complete" | "failed";
    className?: string;
}

const STEP_CONFIG: Record<string, { icon: React.ElementType; label: string; instruction: string }> = {
    blink: {
        icon: Eye,
        label: "Blink Eyes",
        instruction: "Close and open your eyes naturally",
    },
    turn_left: {
        icon: ArrowLeft,
        label: "Turn Left",
        instruction: "Turn your head to the left",
    },
    turn_right: {
        icon: ArrowRight,
        label: "Turn Right",
        instruction: "Turn your head to the right",
    },
    smile: {
        icon: Smile,
        label: "Smile",
        instruction: "Give a natural smile",
    },
};

export default function ChallengeDisplay({
    steps,
    currentStepIndex,
    status,
    className = "",
}: ChallengeDisplayProps) {
    return (
        <div className={`space-y-3 ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                    Challenge Sequence
                </h3>
                <div className={`chip ${status === "complete" ? "chip-success" :
                        status === "failed" ? "chip-danger" :
                            status === "active" ? "chip-primary" :
                                "chip-cyan"
                    }`}>
                    {status === "complete" ? "PASSED" :
                        status === "failed" ? "FAILED" :
                            status === "active" ? "IN PROGRESS" :
                                "READY"}
                </div>
            </div>

            {/* Steps */}
            {steps.map((step, idx) => {
                const config = STEP_CONFIG[step.step] || { icon: Circle, label: step.step, instruction: "" };
                const Icon = config.icon;
                const isActive = idx === currentStepIndex && status === "active";
                const isPassed = step.detected;
                const isFuture = idx > currentStepIndex;

                return (
                    <motion.div
                        key={idx}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.15, duration: 0.4 }}
                        className={`relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300 ${isPassed
                                ? "bg-[rgba(16,185,129,0.08)] border border-[rgba(16,185,129,0.25)]"
                                : isActive
                                    ? "bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.3)] glow-primary"
                                    : "bg-[var(--muted)] border border-[var(--border)]"
                            } ${isFuture ? "opacity-40" : ""}`}
                    >
                        {/* Step number + icon */}
                        <div
                            className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${isPassed
                                    ? "bg-[rgba(16,185,129,0.2)] text-[#10b981]"
                                    : isActive
                                        ? "bg-[rgba(99,102,241,0.2)] text-[#818cf8]"
                                        : "bg-[var(--border)] text-[var(--muted-foreground)]"
                                }`}
                        >
                            {isPassed ? (
                                <CheckCircle2 size={20} />
                            ) : isActive ? (
                                <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                                >
                                    <Loader2 size={20} />
                                </motion.div>
                            ) : (
                                <Icon size={20} />
                            )}
                        </div>

                        {/* Step info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono text-[var(--muted-foreground)]">
                                    0{idx + 1}
                                </span>
                                <span className={`font-semibold text-sm ${isPassed ? "text-[#10b981]" : isActive ? "text-white" : "text-[var(--muted-foreground)]"
                                    }`}>
                                    {config.label}
                                </span>
                            </div>
                            {isActive && (
                                <motion.p
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: "auto" }}
                                    className="text-xs text-[var(--primary)] mt-1"
                                >
                                    {config.instruction}
                                </motion.p>
                            )}
                        </div>

                        {/* Confidence badge */}
                        {isPassed && step.confidence !== undefined && (
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                className="chip chip-success text-[10px]"
                            >
                                {Math.round(step.confidence * 100)}%
                            </motion.div>
                        )}
                    </motion.div>
                );
            })}

            {/* Progress bar */}
            <div className="mt-4 h-1.5 bg-[var(--muted)] rounded-full overflow-hidden">
                <motion.div
                    className="h-full rounded-full"
                    style={{
                        background: status === "failed"
                            ? "#ef4444"
                            : "linear-gradient(90deg, #6366f1, #06b6d4, #10b981)",
                    }}
                    initial={{ width: "0%" }}
                    animate={{
                        width: `${(steps.filter((s) => s.detected).length / steps.length) * 100}%`,
                    }}
                    transition={{ duration: 0.5 }}
                />
            </div>
        </div>
    );
}
