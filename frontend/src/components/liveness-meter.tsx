"use client";

import { motion } from "framer-motion";

interface LivenessMeterProps {
    score: number; // 0-100
    size?: number;
    className?: string;
}

export default function LivenessMeter({
    score,
    size = 160,
    className = "",
}: LivenessMeterProps) {
    const radius = (size - 16) / 2;
    const circumference = 2 * Math.PI * radius;
    const progress = (score / 100) * circumference;
    const offset = circumference - progress;

    const getColor = () => {
        if (score >= 80) return { stroke: "#10b981", bg: "rgba(16,185,129,0.1)", label: "HIGH" };
        if (score >= 60) return { stroke: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: "MEDIUM" };
        if (score > 0) return { stroke: "#ef4444", bg: "rgba(239,68,68,0.1)", label: "LOW" };
        return { stroke: "#3f3f5a", bg: "transparent", label: "—" };
    };

    const color = getColor();

    return (
        <div className={`flex flex-col items-center gap-3 ${className}`}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    className="transform -rotate-90"
                    viewBox={`0 0 ${size} ${size}`}
                >
                    {/* Background circle */}
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(30,30,58,0.8)"
                        strokeWidth="8"
                    />
                    {/* Progress circle */}
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color.stroke}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 1.5, ease: "easeOut" }}
                        style={{ filter: `drop-shadow(0 0 8px ${color.stroke}40)` }}
                    />
                </svg>
                {/* Center text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                        className="text-3xl font-bold font-mono"
                        style={{ color: color.stroke }}
                        key={Math.round(score)}
                        initial={{ scale: 1.3, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                    >
                        {Math.round(score)}
                    </motion.span>
                    <span className="text-[10px] font-semibold tracking-widest" style={{ color: `${color.stroke}99` }}>
                        % LIVE
                    </span>
                </div>
            </div>
            <div
                className="chip text-[10px]"
                style={{
                    background: color.bg,
                    color: color.stroke,
                    border: `1px solid ${color.stroke}40`,
                }}
            >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: color.stroke }} />
                LIVENESS: {color.label}
            </div>
        </div>
    );
}
