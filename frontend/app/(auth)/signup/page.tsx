"use client";

/**
 * Signup page — split-screen with gradient mesh + modern form
 */
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const TIERS = [
  {
    id: "starter",
    name: "Starter",
    price: "$99/mo",
    description: "Core proposal generation",
    note: "No Context-Mapper",
  },
  {
    id: "professional",
    name: "Professional",
    price: "$249/mo",
    description: "Full Context-Mapper",
    note: "Recommended — institutional memory moat",
    highlight: true,
  },
];

export default function SignupPage() {
  const { signUp } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tier, setTier] = useState<"starter" | "professional">("professional");
  const [industry, setIndustry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUp(name, email, password, tier, industry || undefined);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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

        .signup-input {
          width: 100%;
          padding: 11px 14px 11px 42px;
          border: 1.5px solid var(--vellum-border);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: var(--ink-primary);
          background: var(--card-bg);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .signup-input-no-icon {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid var(--vellum-border);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: var(--ink-primary);
          background: var(--card-bg);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .signup-input::placeholder, .signup-input-no-icon::placeholder {
          color: var(--ink-muted);
        }
        .signup-input:focus, .signup-input-no-icon:focus {
          border-color: var(--indigo);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .signup-select {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid var(--vellum-border);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: var(--ink-primary);
          background: var(--card-bg);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          appearance: none;
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' fill='none' stroke='%2394A3B8' stroke-width='1.5'%3E%3Cpath d='M1 1l5 5 5-5'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }
        .signup-select:focus {
          border-color: var(--indigo);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
        }

        .signup-submit {
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
        .signup-submit:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.3);
        }
        .signup-submit:active:not(:disabled) {
          transform: translateY(0);
        }
        .signup-submit::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.2) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmerBtn 3s linear infinite;
        }
        .signup-submit:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .tier-card {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 16px;
          border: 1.5px solid var(--vellum-border);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s;
          background: var(--card-bg);
        }
        .tier-card:hover {
          border-color: rgba(99,102,241,0.3);
          box-shadow: 0 2px 12px rgba(99,102,241,0.06);
        }
        .tier-card.selected {
          border-color: var(--indigo);
          background: var(--indigo-light);
          box-shadow: 0 2px 16px rgba(99,102,241,0.1);
        }
        .tier-card input[type="radio"] {
          accent-color: var(--indigo);
          width: 16px;
          height: 16px;
        }
      `}</style>

      <div style={{ display: "flex", minHeight: "100vh" }}>
        {/* ── Left panel: gradient mesh ── */}
        <div style={{
          flex: "0 0 45%",
          background: "linear-gradient(150deg, #312E81 0%, #4338CA 25%, #6366F1 55%, #818CF8 80%, #C4B5FD 100%)",
          backgroundSize: "200% 200%",
          animation: "authMeshShift 14s ease infinite",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          padding: "56px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Floating shapes */}
          <div style={{
            position: "absolute",
            top: "8%",
            right: "15%",
            width: "100px",
            height: "100px",
            border: "2px solid rgba(255,255,255,0.12)",
            borderRadius: "20px",
            transform: "rotate(25deg)",
            animation: "authShapeFloat 8s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute",
            bottom: "15%",
            left: "10%",
            width: "70px",
            height: "70px",
            border: "2px solid rgba(255,255,255,0.1)",
            borderRadius: "50%",
            animation: "authShapeFloat2 10s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute",
            top: "60%",
            right: "25%",
            width: "45px",
            height: "45px",
            background: "rgba(255,255,255,0.05)",
            borderRadius: "10px",
            transform: "rotate(-15deg)",
            animation: "authShapeFloat 12s ease-in-out infinite",
          }} />
          {/* Glow orb */}
          <div style={{
            position: "absolute",
            bottom: "30%",
            left: "30%",
            width: "180px",
            height: "180px",
            borderRadius: "50%",
            background: "rgba(255,255,255,0.06)",
            filter: "blur(50px)",
            animation: "authGlowPulse 5s ease-in-out infinite",
          }} />

          {/* Brand content */}
          <div style={{ position: "relative", zIndex: 1, maxWidth: "380px" }}>
            <div style={{ animation: "authFadeUp 0.6s ease both" }}>
              <span style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "32px",
                fontWeight: 700,
                color: "#fff",
                letterSpacing: "-1px",
                display: "block",
                marginBottom: "16px",
              }}>
                Draftly
              </span>
            </div>
            <div style={{ animation: "authFadeUp 0.6s 0.12s ease both" }}>
              <h1 style={{
                fontFamily: "'Outfit', sans-serif",
                fontSize: "24px",
                fontWeight: 300,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.4,
                marginBottom: "20px",
              }}>
                Start winning more proposals<br />
                with <em style={{ fontWeight: 600 }}>AI that knows your firm</em>.
              </h1>
            </div>
            <div style={{ animation: "authFadeUp 0.6s 0.24s ease both" }}>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: "14px",
                color: "rgba(255,255,255,0.6)",
                lineHeight: 1.7,
                marginBottom: "28px",
              }}>
                Join firms that have already transformed their proposal workflows with Context-Mapper intelligence.
              </p>
            </div>

            {/* Floating stat cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", animation: "authFadeUp 0.6s 0.36s ease both" }}>
              {[
                { stat: "73%", label: "avg win rate increase" },
                { stat: "10x", label: "faster proposal generation" },
                { stat: "847", label: "proposals in knowledge graph" },
              ].map((item) => (
                <div key={item.stat} style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.08)",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.1)",
                  backdropFilter: "blur(8px)",
                }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 500, color: "#fff" }}>
                    {item.stat}
                  </span>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "rgba(255,255,255,0.6)" }}>
                    {item.label}
                  </span>
                </div>
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
          padding: "40px 48px",
          background: "var(--vellum)",
          position: "relative",
          overflowY: "auto",
        }}>
          {/* Subtle grain */}
          <div style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
            pointerEvents: "none",
          }} />

          <div style={{ width: "100%", maxWidth: "440px", position: "relative", zIndex: 1, animation: "authSlideRight 0.5s 0.2s ease both" }}>
            <div style={{ marginBottom: "28px" }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "24px", fontWeight: 600, color: "var(--ink-primary)", marginBottom: "6px" }}>
                Create your account
              </h2>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "14px", color: "var(--ink-secondary)" }}>
                Start your free trial — no credit card required
              </p>
            </div>

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
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

              {/* Name + Industry row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                    Full name
                  </label>
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "14px" }}>👤</span>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="signup-input"
                      placeholder="Jane Smith"
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                    Industry
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="signup-select"
                  >
                    <option value="">Select…</option>
                    <option value="marketing_agency">Marketing Agency</option>
                    <option value="consulting">Consulting</option>
                    <option value="legal">Legal</option>
                    <option value="accounting">Accounting</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                  Email
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "14px" }}>✉</span>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="signup-input"
                    placeholder="you@yourfirm.com"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "6px" }}>
                  Password
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "var(--ink-muted)", fontSize: "14px" }}>🔒</span>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="signup-input"
                    placeholder="Min 8 characters"
                  />
                </div>
              </div>

              {/* Tier selection */}
              <div>
                <label style={{ display: "block", fontFamily: "'Outfit', sans-serif", fontSize: "13px", fontWeight: 500, color: "var(--ink-primary)", marginBottom: "8px" }}>
                  Choose your plan
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {TIERS.map((t) => (
                    <label
                      key={t.id}
                      className={`tier-card ${tier === t.id ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="tier"
                        value={t.id}
                        checked={tier === t.id}
                        onChange={() => setTier(t.id as "starter" | "professional")}
                      />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "14px", fontWeight: 600, color: "var(--ink-primary)" }}>{t.name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "13px", fontWeight: 500, color: "var(--indigo)" }}>{t.price}</span>
                          {t.highlight && (
                            <span style={{
                              fontFamily: "'JetBrains Mono', monospace",
                              fontSize: "10px",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              background: "var(--indigo-glow)",
                              color: "var(--indigo)",
                              fontWeight: 500,
                            }}>
                              Recommended
                            </span>
                          )}
                        </div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: "12px", color: "var(--ink-muted)", marginTop: "2px" }}>{t.note}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              <button type="submit" disabled={loading} className="signup-submit">
                {loading ? "Creating account…" : "Create account"}
              </button>

              <p style={{ textAlign: "center", fontFamily: "'DM Sans', sans-serif", fontSize: "13px", color: "var(--ink-secondary)" }}>
                Already have an account?{" "}
                <Link href="/login" style={{ color: "var(--indigo)", textDecoration: "none", fontWeight: 500, transition: "opacity 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.7")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
                >
                  Sign in →
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
