"use client";

/**
 * Login page — split-screen with gradient mesh + modern form
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes authMeshShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes authFadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes authSlideRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes authShapeFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-18px) rotate(6deg); }
          66% { transform: translateY(8px) rotate(-4deg); }
        }
        @keyframes authShapeFloat2 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(14px) rotate(-5deg); }
          70% { transform: translateY(-10px) rotate(3deg); }
        }
        @keyframes shimmerBtn {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes authGlowPulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 0.7; }
        }

        .auth-input {
          width: 100%;
          padding: 12px 16px 12px 44px;
          border: 1.5px solid var(--vellum-border);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: var(--ink-primary);
          background: var(--card-bg);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .auth-input::placeholder {
          color: var(--ink-muted);
        }
        .auth-input:focus {
          border-color: var(--indigo);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .auth-submit {
          width: 100%;
          padding: 13px 24px;
          border: none;
          border-radius: 10px;
          font-family: 'Outfit', sans-serif;
          font-size: 15px;
          font-weight: 600;
          color: #fff;
          background: linear-gradient(135deg, var(--indigo), var(--indigo-hover));
          cursor: pointer;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .auth-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.3);
        }
        .auth-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .auth-submit::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmerBtn 3s linear infinite;
        }
        .auth-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* ── Left panel: gradient mesh ── */}
        <div style={{
          flex: "0 0 55%",
          background: "linear-gradient(135deg, #4338CA 0%, #6366F1 30%, #818CF8 60%, #A78BFA 100%)",
          backgroundSize: "200% 200%",
          animation: "authMeshShift 12s ease infinite",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "64px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Floating geometric shapes */}
          <div style={{
            position: "absolute",
            top: "12%",
            left: "10%",
            width: "120px",
            height: "120px",
            border: "2px solid rgba(255,255,255,0.15)",
            borderRadius: "24px",
            transform: "rotate(15deg)",
            animation: "authShapeFloat 7s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute",
            bottom: "18%",
            right: "12%",
            width: "80px",
            height: "80px",
            border: "2px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            animation: "authShapeFloat2 9s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute",
            top: "55%",
            left: "65%",
            width: "60px",
            height: "60px",
            background: "rgba(255,255,255,0.06)",
            borderRadius: "12px",
            transform: "rotate(-20deg)",
            animation: "authShapeFloat 11s ease-in-out infinite",
          }} />
          {/* Glow orb */}
          <div style={{
            position: "absolute",
            top: "30%",
            right: "20%",
            width: "200px",
            height: "200px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.08)",
            filter: "blur(60px)",
            animation: "authGlowPulse 4s ease-in-out infinite",
          }} />

          {/* Brand content */}
          <div style={{ position: "relative", zIndex: 1, maxWidth: "420px" }}>
            <div style={{ animation: "authFadeUp 0.6s ease both" }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "36px",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-1px",
                display: "block",
                marginBottom: "16px",
              }}>
                Draftly
              </span>
            </div>
            <div style={{ animation: "authFadeUp 0.6s 0.15s ease both" }}>
              <h1 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "28px",
                fontWeight: 300,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.4,
                marginBottom: "24px",
              }}>
                Your firm&apos;s institutional memory,<br />
                turned into a <em style={{ fontWeight: 600 }}>competitive moat</em>.
              </h1>
            </div>
            <div style={{ animation: "authFadeUp 0.6s 0.3s ease both" }}>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "15px",
                color: "rgba(255,255,255,0.65)",
                lineHeight: 1.7,
              }}>
                847 proposals indexed. 73% win rate. Every deal — won or lost — makes your next proposal sharper.
              </p>
            </div>

            {/* Feature pills */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginTop: "32px", animation: "authFadeUp 0.6s 0.45s ease both" }}>
              {["Context-Mapper", "RAG Pipeline", "Pricing Intel", "DOCX Export"].map((f, i) => (
                <span key={f} style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  color: "rgba(255,255,255,0.7)",
                  border: "1px solid rgba(255,255,255,0.2)",
                  padding: "5px 12px",
                  borderRadius: "20px",
                  background: "rgba(255,255,255,0.06)",
                  animationDelay: `${0.5 + i * 0.08}s`,
                }}>
                  {f}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right panel: form ── */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          background: "var(--vellum)",
          position: "relative",
        }}>
          {/* Subtle grain */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
            pointerEvents: "none",
          }} />

          <div style={{ width: "100%", maxWidth: "380px", position: "relative", zIndex: 1, animation: "authSlideRight 0.5s 0.2s ease both" }}>
            <div style={{ marginBottom: "32px" }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "24px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "6px" }}>
                Welcome back
              </h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "var(--ink-secondary)" }}>
                Sign in to your Draftly account
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {error && (
                <div style={{
                  background: "var(--coral-light)",
                  border: "1px solid rgba(249,112,102,0.3)",
                  color: "var(--coral)",
                  fontSize: "13px",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {error}
                </div>
              )}

              <div>
                <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "16px" }}>✉</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="auth-input"
                    placeholder="you@yourfirm.com"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "16px" }}>🔒</span>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="auth-input"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="auth-submit">
                {loading ? "Signing in…" : "Sign in"}
              </button>

              <p style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "var(--ink-secondary)" }}>
                No account?{" "}
                <Link href="/signup" style={{ color: "var(--indigo)", textDecoration: "none", fontWeight: 500, transition: "opacity 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  Sign up free →
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
