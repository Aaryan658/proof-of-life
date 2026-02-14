"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, ShieldAlert } from "lucide-react";

interface TokenCountdownProps {
    expiresAt: string; // ISO timestamp
    className?: string;
}

export default function TokenCountdown({ expiresAt, className = "" }: TokenCountdownProps) {
    const [remaining, setRemaining] = useState(0);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        const expiryTime = new Date(expiresAt).getTime();
        const now = Date.now();
        const totalSeconds = Math.max(0, Math.floor((expiryTime - now) / 1000));
        setTotal(totalSeconds);
        setRemaining(totalSeconds);

        const interval = setInterval(() => {
            const left = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000));
            setRemaining(left);
            if (left <= 0) clearInterval(interval);
        }, 1000);

        return () => clearInterval(interval);
    }, [expiresAt]);

    const minutes = Math.floor(remaining / 60);
    const seconds = remaining % 60;
    const progress = total > 0 ? remaining / total : 0;
    const isExpired = remaining <= 0;
    const isWarning = remaining > 0 && remaining <= 60;

    const size = 120;
    const radius = (size - 12) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - progress * circumference;

    const color = isExpired ? "#ef4444" : isWarning ? "#f59e0b" : "#10b981";

    return (
        <div className={`flex flex-col items-center gap-3 ${className}`}>
            <div className="relative" style={{ width: size, height: size }}>
                <svg
                    width={size}
                    height={size}
                    className="transform -rotate-90"
                    viewBox={`0 0 ${size} ${size}`}
                >
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="rgba(30,30,58,0.8)"
                        strokeWidth="6"
                    />
                    <motion.circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke={color}
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        animate={{ strokeDashoffset: offset }}
                        transition={{ duration: 0.5 }}
                        style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
                    />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    {isExpired ? (
                        <ShieldAlert size={24} className="text-red-400" />
                    ) : (
                        <>
                            <span className="text-2xl font-bold font-mono" style={{ color }}>
                                {minutes}:{seconds.toString().padStart(2, "0")}
                            </span>
                            <span className="text-[9px] font-semibold tracking-widest" style={{ color: `${color}99` }}>
                                REMAINING
                            </span>
                        </>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2">
                {isExpired ? (
                    <div className="chip chip-danger">
                        <ShieldAlert size={12} />
                        TOKEN EXPIRED
                    </div>
                ) : isWarning ? (
                    <div className="chip chip-warning">
                        <Clock size={12} />
                        EXPIRING SOON
                    </div>
                ) : (
                    <div className="chip chip-success">
                        <ShieldCheck size={12} />
                        TOKEN ACTIVE
                    </div>
                )}
            </div>
        </div>
    );
}
