"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
    Shield, ShieldCheck, ShieldAlert, Lock, ArrowLeft,
    CheckCircle2, User, Clock, Key, AlertTriangle
} from "lucide-react";
import TokenCountdown from "@/components/token-countdown";
import { accessProtected, type ProtectedResponse } from "@/lib/api";

type PageState = "loading" | "authorized" | "denied";

export default function ProtectedPage() {
    const router = useRouter();
    const [state, setState] = useState<PageState>("loading");
    const [data, setData] = useState<ProtectedResponse | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tokenExpires, setTokenExpires] = useState<string>("");

    useEffect(() => {
        async function checkToken() {
            const token = sessionStorage.getItem("pol_token");
            const expires = sessionStorage.getItem("pol_token_expires") || "";
            setTokenExpires(expires);

            if (!token) {
                setError("No access token found. Please complete verification first.");
                setState("denied");
                return;
            }

            try {
                const res = await accessProtected(token);
                setData(res);
                setState("authorized");
            } catch (err) {
                setError(err instanceof Error ? err.message : "Access denied");
                setState("denied");
            }
        }

        checkToken();
    }, []);

    return (
        <div className="min-h-screen bg-[var(--background)] bg-grid relative flex items-center justify-center">
            <div className="bg-radial-glow absolute inset-0 pointer-events-none" />

            {/* Floating orbs */}
            <div className="absolute top-40 right-20 w-64 h-64 bg-[var(--success)] rounded-full blur-[100px] opacity-10 animate-float" />
            <div className="absolute bottom-40 left-20 w-80 h-80 bg-[var(--primary)] rounded-full blur-[120px] opacity-8 animate-float" style={{ animationDelay: "2s" }} />

            <div className="relative z-10 w-full max-w-lg mx-auto px-6">
                {/* Back button */}
                <button
                    onClick={() => router.push("/")}
                    className="flex items-center gap-2 text-[var(--muted-foreground)] hover:text-white transition-colors mb-8"
                >
                    <ArrowLeft size={18} />
                    <span className="text-sm font-medium">Home</span>
                </button>

                <AnimatePresence mode="wait">
                    {/* Loading */}
                    {state === "loading" && (
                        <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="glass-card p-10 text-center"
                        >
                            <div className="w-12 h-12 border-3 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            <p className="text-[var(--muted-foreground)] text-sm">Validating access token...</p>
                        </motion.div>
                    )}

                    {/* Authorized */}
                    {state === "authorized" && data && (
                        <motion.div
                            key="authorized"
                            initial={{ opacity: 0, y: 20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0 }}
                            className="space-y-5"
                        >
                            {/* Success header */}
                            <div className="glass-card p-8 text-center glow-success">
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                                >
                                    <ShieldCheck size={56} className="text-[var(--success)] mx-auto mb-4" />
                                </motion.div>
                                <h1 className="text-2xl font-bold text-[var(--success)] mb-2">Access Granted</h1>
                                <p className="text-sm text-[var(--muted-foreground)]">{data.message}</p>
                            </div>

                            {/* Token info */}
                            <div className="glass-card p-6 space-y-4">
                                <h3 className="text-sm font-semibold text-[var(--muted-foreground)] uppercase tracking-wider">
                                    Token Details
                                </h3>
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 text-sm">
                                        <User size={16} className="text-[var(--primary)] shrink-0" />
                                        <span className="text-[var(--muted-foreground)]">Subject:</span>
                                        <span className="font-mono text-xs ml-auto truncate max-w-[200px]">{data.user}</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Clock size={16} className="text-[var(--cyan)] shrink-0" />
                                        <span className="text-[var(--muted-foreground)]">Issued:</span>
                                        <span className="font-mono text-xs ml-auto">
                                            {new Date(data.token_issued_at).toLocaleTimeString()}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-sm">
                                        <Key size={16} className="text-[var(--warning)] shrink-0" />
                                        <span className="text-[var(--muted-foreground)]">Access Level:</span>
                                        <span className="chip chip-success text-[10px] ml-auto">{data.access_level.toUpperCase()}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Countdown */}
                            {tokenExpires && (
                                <div className="glass-card p-6">
                                    <TokenCountdown expiresAt={tokenExpires} />
                                </div>
                            )}

                            {/* Protected content demo */}
                            <div className="glass-card p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <Lock size={16} className="text-[var(--primary)]" />
                                    <h3 className="text-sm font-semibold">Protected Resource</h3>
                                </div>
                                <div className="p-4 rounded-xl bg-[rgba(99,102,241,0.08)] border border-[rgba(99,102,241,0.15)]">
                                    <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                                        🎉 This content is only accessible to verified live humans.
                                        Your identity has been confirmed through multi-factor liveness detection.
                                        This token will expire automatically for security.
                                    </p>
                                </div>
                                <div className="flex items-center gap-3 mt-4">
                                    <CheckCircle2 size={14} className="text-[var(--success)]" />
                                    <span className="text-xs text-[var(--muted-foreground)]">
                                        Verified via MediaPipe Face Mesh (468 landmarks)
                                    </span>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* Denied */}
                    {state === "denied" && (
                        <motion.div
                            key="denied"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0 }}
                            className="space-y-5"
                        >
                            <div className="glass-card p-8 text-center glow-danger">
                                <ShieldAlert size={56} className="text-[var(--danger)] mx-auto mb-4" />
                                <h1 className="text-2xl font-bold text-[var(--danger)] mb-2">Access Denied</h1>
                                <p className="text-sm text-[var(--muted-foreground)]">{error}</p>
                            </div>

                            <div className="glass-card p-5">
                                <div className="flex items-start gap-3">
                                    <AlertTriangle size={18} className="text-[var(--warning)] shrink-0 mt-0.5" />
                                    <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                                        Access to this resource requires a valid, unexpired JWT token issued
                                        through the liveness verification process. Tokens are single-use and
                                        expire after 5 minutes.
                                    </p>
                                </div>
                            </div>

                            <button
                                onClick={() => router.push("/verify")}
                                className="btn-primary w-full py-3 flex items-center justify-center gap-2"
                            >
                                <Shield size={18} />
                                Complete Verification
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
