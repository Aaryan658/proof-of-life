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
    },
    {
      icon: Shield,
      title: "Anti-Replay Protection",
      description: "One-time challenges with expiration timestamps prevent video replay attacks.",
    },
    {
      icon: Lock,
      title: "Secure Access Tokens",
      description: "JWT tokens with 5-minute expiry. Server-side validation. Hash-stored in PostgreSQL.",
    },
    {
      icon: Eye,
      title: "Spoof Resistance",
      description: "Temporal consistency checks reject static images, printed photos, and screen displays.",
    },
    {
      icon: Fingerprint,
      title: "Multi-Factor Challenge",
      description: "Randomized compound gestures — blink, smile, head turns — verified in sequence.",
    },
    {
      icon: Zap,
      title: "Low-Latency Pipeline",
      description: "Frame downscaling, landmark-only processing, and early exit optimization.",
    },
  ];

  const stats = [
    { label: "Face Landmarks", value: "468" },
    { label: "Challenge Types", value: "4" },
    { label: "Token Expiry", value: "5 min" },
    { label: "Replay Protection", value: "One-Time" },
    { label: "Detection Speed", value: "<200ms" },
  ];

  return (
    <div className="min-h-screen bg-emerald-gradient relative overflow-hidden leaf-pattern">
      <div className="bg-radial-glow absolute inset-0 pointer-events-none" />

      {/* Decorative blurs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-[#2ecc71] rounded-full blur-[150px] opacity-[0.06] animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#d4a847] rounded-full blur-[180px] opacity-[0.04] animate-float" style={{ animationDelay: "3s" }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#1a6b4a] rounded-full blur-[200px] opacity-[0.08]" />

      {/* Navbar */}
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#1a6b4a] to-[#2ecc71] flex items-center justify-center border border-[rgba(46,204,113,0.3)]">
            <Shield size={18} className="text-white" />
          </div>
          <span className="heading-serif text-xl tracking-tight">Proof of Life</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="chip chip-success text-[10px]">
            <span className="w-1.5 h-1.5 bg-[#27ae60] rounded-full animate-pulse" />
            SYSTEM ONLINE
          </span>
        </div>
      </motion.nav>

      {/* Hero */}
      <main className="relative z-10 max-w-7xl mx-auto px-8 pt-12 pb-24">
        <div className="text-center max-w-3xl mx-auto mb-24">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="chip chip-gold mb-8 inline-flex">
              <Zap size={12} />
              ANTI-DEEPFAKE IDENTITY VERIFICATION
            </div>
          </motion.div>

          <motion.p
            className="heading-serif-italic text-lg text-[var(--muted-foreground)] mb-3"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Empowering
          </motion.p>

          <motion.h1
            className="heading-serif text-5xl sm:text-6xl md:text-8xl mb-8"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.15 }}
          >
            <span className="text-gradient">Proof of</span>
            <br />
            <span className="text-[var(--cream)]" style={{ fontStyle: 'italic' }}>Life</span>
          </motion.h1>

          <motion.p
            className="text-base text-[var(--muted-foreground)] leading-relaxed mb-10 max-w-xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.25 }}
          >
            Verify you&apos;re a real, live human — not a deepfake, photo, or replay.
            Real-time computer vision analyzes your gestures in sequence.
          </motion.p>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
          >
            <button
              onClick={() => router.push("/verify")}
              className="btn-primary text-lg px-12 py-4 flex items-center gap-3"
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

        {/* Stats Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-8 flex flex-wrap items-center justify-center gap-10 mb-24"
        >
          {stats.map((stat, i) => (
            <div key={i} className="text-center px-2">
              <div className="text-2xl font-bold font-mono text-[var(--primary)]">
                {stat.value}
              </div>
              <div className="text-[10px] text-[var(--muted-foreground)] font-semibold tracking-[0.15em] uppercase mt-1.5">
                {stat.label}
              </div>
            </div>
          ))}
        </motion.div>

        {/* Features */}
        <section id="features">
          <motion.div
            className="text-center mb-14"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <p className="heading-serif-italic text-[var(--muted-foreground)] text-sm mb-2">Our</p>
            <h2 className="heading-serif text-4xl">
              Security <span className="text-gradient-gold">Architecture</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="glass-card glass-card-hover p-7 group cursor-default"
                >
                  <div className="flex items-start gap-4">
                    <div className="num-circle">
                      {idx + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="heading-serif text-base mb-2 text-[var(--cream)]">{feature.title}</h3>
                      <p className="text-sm text-[var(--muted-foreground)] leading-relaxed">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 ml-[52px] flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon size={14} className="text-[var(--primary)]" />
                    <span className="text-xs text-[var(--primary)]">Active</span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* CTA Bottom */}
        <motion.div
          className="text-center mt-24"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
        >
          <div className="divider-leaf mb-10">
            <span className="text-[var(--primary)] text-lg">🌿</span>
          </div>
          <p className="heading-serif-italic text-[var(--muted-foreground)] mb-6 text-base">
            Ready to prove you&apos;re human?
          </p>
          <button
            onClick={() => router.push("/verify")}
            className="btn-primary px-10 py-4 inline-flex items-center gap-3"
          >
            <Shield size={18} />
            Start Verification
          </button>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-[var(--border)] py-8 text-center">
        <p className="text-xs text-[var(--muted-foreground)] tracking-wider">
          Proof of Life Authentication System · MediaPipe + OpenCV + FastAPI + Next.js
        </p>
      </footer>
    </div>
  );
}
