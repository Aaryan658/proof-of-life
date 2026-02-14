"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Shield, Scan, Lock, Fingerprint, Zap, Eye } from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  const features = [
    {
      icon: Scan,
      title: "Liveness Detection",
      description: "MediaPipe Face Mesh analyzes 468 landmarks in real-time to verify human presence.",
      color: "#6366f1",
    },
    {
      icon: Shield,
      title: "Anti-Replay Protection",
      description: "One-time challenges with expiration timestamps prevent video replay attacks.",
      color: "#06b6d4",
    },
    {
      icon: Lock,
      title: "Secure Access Tokens",
      description: "JWT tokens with 5-minute expiry. Server-side validation. Hash-stored in PostgreSQL.",
      color: "#10b981",
    },
    {
      icon: Eye,
      title: "Spoof Resistance",
      description: "Temporal consistency checks reject static images, printed photos, and screen displays.",
      color: "#f59e0b",
    },
    {
      icon: Fingerprint,
      title: "Multi-Factor Challenge",
      description: "Randomized compound gestures — blink, smile, head turns — verified in sequence.",
      color: "#ec4899",
    },
    {
      icon: Zap,
      title: "Low-Latency Pipeline",
      description: "Frame downscaling, landmark-only processing, and early exit optimization.",
      color: "#8b5cf6",
    },
  ];

  return (
    <div className="min-h-screen bg-[var(--background)] bg-grid relative overflow-hidden">
      {/* Radial glow */}
      <div className="bg-radial-glow absolute inset-0 pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[var(--primary)] rounded-full blur-[120px] opacity-10 animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[var(--cyan)] rounded-full blur-[150px] opacity-8 animate-float" style={{ animationDelay: "3s" }} />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 flex items-center justify-between px-8 py-5 max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--primary)] to-[var(--cyan)] flex items-center justify-center">
            <Shield size={18} className="text-white" />
          </div>
          <span className="font-bold text-lg tracking-tight">Proof of Life</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="chip chip-success text-[10px]">SYSTEM ONLINE</span>
        </div>
      </motion.nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-16 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="chip chip-primary mb-6 inline-flex">
              <Zap size={12} />
              ANTI-DEEPFAKE IDENTITY VERIFICATION
            </div>
          </motion.div>

          <motion.h1
            className="text-5xl md:text-7xl font-black leading-tight mb-6"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <span className="text-gradient">Proof of Life</span>
            <br />
            <span className="text-[var(--foreground)]">Authentication</span>
          </motion.h1>

          <motion.p
            className="text-lg text-[var(--muted-foreground)] leading-relaxed mb-10 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            Verify you&apos;re a real, live human — not a deepfake, photo, or replay.
            Real-time computer vision analyzes your gestures in sequence.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <button
              onClick={() => router.push("/verify")}
              className="btn-primary text-lg px-10 py-4 flex items-center gap-3"
            >
              <Scan size={20} />
              Begin Verification
            </button>
            <button
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="btn-outline px-8 py-3"
            >
              How It Works
            </button>
          </motion.div>
        </div>

        {/* Security Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-6 flex flex-wrap items-center justify-center gap-6 mb-20"
        >
          {[
            { label: "Face Landmarks", value: "468", color: "#6366f1" },
            { label: "Challenge Types", value: "4", color: "#06b6d4" },
            { label: "Token Expiry", value: "5 min", color: "#10b981" },
            { label: "Replay Protection", value: "One-Time", color: "#f59e0b" },
            { label: "Detection Speed", value: "<200ms", color: "#ec4899" },
          ].map((stat, i) => (
            <div key={i} className="text-center px-4">
              <div className="text-2xl font-bold font-mono" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-[11px] text-[var(--muted-foreground)] font-semibold tracking-wider uppercase mt-1">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Features Grid */}
        <section id="features">
          <motion.h2
            className="text-center text-3xl font-bold mb-12"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            Security <span className="text-gradient">Architecture</span>
          </motion.h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card glass-card-hover p-6 group cursor-default"
                >
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
                    style={{ background: `${feature.color}15`, color: feature.color }}
                  >
                    <Icon size={22} />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{feature.title}</h3>
                  <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                    {feature.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA Bottom */}
        <motion.div
          className="text-center mt-20 pt-12 border-t border-[var(--border)]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <p className="text-[var(--muted-foreground)] mb-6 text-sm">
            Ready to prove you&apos;re human?
          </p>
          <button
            onClick={() => router.push("/verify")}
            className="btn-primary px-8 py-3 inline-flex items-center gap-2"
          >
            <Shield size={18} />
            Start Verification
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-6 text-center">
        <p className="text-xs text-[var(--muted-foreground)]">
          Proof of Life Authentication System · MediaPipe + OpenCV + FastAPI + Next.js
        </p>
      </footer>
    </div>
  );
}
