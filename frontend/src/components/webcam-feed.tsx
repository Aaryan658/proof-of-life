"use client";

import { useRef, useEffect, useCallback, useState } from "react";

interface WebcamFeedProps {
    onFrame?: (base64: string) => void;
    captureInterval?: number;
    isCapturing?: boolean;
    className?: string;
}

export default function WebcamFeed({
    onFrame,
    captureInterval = 500,
    isCapturing = false,
    className = "",
}: WebcamFeedProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isReady, setIsReady] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let mounted = true;

        async function startCamera() {
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        width: { ideal: 640 },
                        height: { ideal: 480 },
                        facingMode: "user",
                    },
                    audio: false,
                });

                if (!mounted) {
                    stream.getTracks().forEach((t) => t.stop());
                    return;
                }

                streamRef.current = stream;
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                    videoRef.current.onloadedmetadata = () => {
                        if (mounted) setIsReady(true);
                    };
                }
            } catch (err) {
                if (mounted) {
                    setError(
                        err instanceof DOMException && err.name === "NotAllowedError"
                            ? "Camera access denied. Please allow camera permissions."
                            : "Failed to access camera. Please check your device."
                    );
                }
            }
        }

        startCamera();

        return () => {
            mounted = false;
            if (streamRef.current) {
                streamRef.current.getTracks().forEach((t) => t.stop());
            }
        };
    }, []);

    const captureFrame = useCallback(() => {
        if (!videoRef.current || !canvasRef.current) return null;

        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = 320;
        canvas.height = Math.round((320 / video.videoWidth) * video.videoHeight) || 240;

        const ctx = canvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        return canvas.toDataURL("image/jpeg", 0.7);
    }, []);

    useEffect(() => {
        if (!isCapturing || !isReady || !onFrame) return;

        const interval = setInterval(() => {
            const frame = captureFrame();
            if (frame) onFrame(frame);
        }, captureInterval);

        return () => clearInterval(interval);
    }, [isCapturing, isReady, onFrame, captureFrame, captureInterval]);

    if (error) {
        return (
            <div className={`relative flex items-center justify-center rounded-2xl bg-[var(--card)] border border-[rgba(231,76,60,0.3)] ${className}`}>
                <div className="text-center p-6">
                    <div className="text-4xl mb-3">📷</div>
                    <p className="text-[#e74c3c] text-sm font-medium">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className={`relative overflow-hidden rounded-2xl ${className}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover transform -scale-x-100"
            />

            <canvas ref={canvasRef} className="hidden" />

            {/* Scan overlay when capturing */}
            {isCapturing && (
                <div className="webcam-scan absolute inset-0 pointer-events-none">
                    <div className="absolute inset-0 border-2 border-[var(--primary)] rounded-2xl opacity-50" />
                    {/* Corner brackets */}
                    <div className="absolute top-3 left-3 w-8 h-8 border-t-2 border-l-2 border-[var(--gold)] rounded-tl-lg" />
                    <div className="absolute top-3 right-3 w-8 h-8 border-t-2 border-r-2 border-[var(--gold)] rounded-tr-lg" />
                    <div className="absolute bottom-3 left-3 w-8 h-8 border-b-2 border-l-2 border-[var(--gold)] rounded-bl-lg" />
                    <div className="absolute bottom-3 right-3 w-8 h-8 border-b-2 border-r-2 border-[var(--gold)] rounded-br-lg" />
                </div>
            )}

            {/* Loading */}
            {!isReady && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-[var(--card)]">
                    <div className="text-center">
                        <div className="w-10 h-10 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                        <p className="text-[var(--muted-foreground)] text-sm">Initializing camera...</p>
                    </div>
                </div>
            )}

            {/* Recording indicator */}
            {isCapturing && isReady && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10">
                    <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-[rgba(231,76,60,0.15)] border border-[rgba(231,76,60,0.3)] backdrop-blur-sm">
                        <div className="w-2 h-2 bg-[#e74c3c] rounded-full animate-pulse" />
                        <span className="text-xs font-mono text-[#e74c3c] font-semibold tracking-wider">ANALYZING</span>
                    </div>
                </div>
            )}
        </div>
    );
}
