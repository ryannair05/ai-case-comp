"use client";

/**
 * Billing page — Structured luxury pricing display.
 * Aesthetic: Clean with bold typographic hierarchy, deep slate base
 * with emerald accent for the recommended plan. Magazine-like card layout.
 * Typography: Fraunces (display serif) + DM Sans (body) + Anybody (data).
 */
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth";
import AppNav from "@/app/components/AppNav";

const PLANS = [
  {
    id: "starter",
    name: "Starter",
    price: "$99",
    period: "/mo",
    description: "Perfect for independent consultants",
    features: ["Up to 15 proposals/mo", "Standard templates", "DOCX export", "Basic analytics"],
    cta: "Current Plan",
    ctaAction: null as string | null,
    highlight: false,
  },
  {
    id: "professional",
    name: "Professional",
    price: "$249",
    period: "/mo",
    description: "Unlock Context-Mapper",
    features: [
      "Unlimited proposals",
      "Context-Mapper (RAG)",
      "Brand voice matching",
      "HubSpot + Pipedrive CRM",
      "Win pattern extraction",
    ],
    cta: "Upgrade to Pro",
    ctaAction: "Professional",
    highlight: true,
  },
  {
    id: "gtm_agent",
    name: "GTM Agent",
    price: "$399",
    period: "/mo",
    description: "Full lifecycle sales automation",
    features: [
      "Everything in Pro",
      "Outreach sequences",
      "Meeting signal extraction",
      "Deal stage Kanban",
      "Win/Loss AI analysis",
    ],
    cta: "Upgrade to GTM",
    ctaAction: "GTM Agent",
    highlight: false,
  },
];

const TIER_RANK: Record<string, number> = { starter: 0, professional: 1, gtm_agent: 2 };

function tierLabel(tier: string): string {
  if (tier === "professional") return "Professional";
  if (tier === "gtm_agent") return "GTM Agent";
  return "Starter";
}

function tierPrice(tier: string): string {
  if (tier === "professional") return "$249/month";
  if (tier === "gtm_agent") return "$399/month";
  return "$99/month";
}

function BillingInner() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [upgraded, setUpgraded] = useState(false);

  const currentTier = user?.tier ?? "starter";
  const currentRank = TIER_RANK[currentTier] ?? 0;

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      setUpgraded(true);
    }
  }, [searchParams]);

  const handleUpgrade = async (tier: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      const { url } = await res.json() as { url: string };
      window.location.href = url;
    } catch (err) {
      console.error("Checkout error:", err);
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes billReveal {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes billCardHover {
          from { transform: translateY(0); }
          to { transform: translateY(-4px); }
        }
        @keyframes billShine {
          0% { left: -100%; }
          100% { left: 200%; }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <AppNav />

        <main style={{ maxWidth: "1000px", margin: "0 auto", padding: "48px 24px" }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "48px", animation: "billReveal 0.5s ease both" }}>
            <h1 style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: "38px", fontWeight: 700,
              color: "#F8FAFC",
              letterSpacing: "-1px",
              margin: "0 0 8px 0",
            }}>
              Choose Your Plan
            </h1>
            <p style={{ fontSize: "16px", color: "rgba(148,163,184,0.6)", maxWidth: "440px", margin: "0 auto" }}>
              Manage your subscription. Every plan includes a 14-day free trial.
            </p>
          </div>

          {/* Upgrade success */}
          {upgraded && (
            <div style={{
              display: "flex", alignItems: "center", gap: "14px",
              padding: "18px 24px", borderRadius: "14px",
              background: "rgba(52,211,153,0.08)",
              border: "1px solid rgba(52,211,153,0.15)",
              marginBottom: "32px",
              animation: "billReveal 0.3s ease both",
            }}>
              <div style={{
                width: "32px", height: "32px", borderRadius: "50%",
                background: "rgba(52,211,153,0.12)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#34D399", fontSize: "16px",
              }}>✓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Fraunces', serif", fontSize: "15px", fontWeight: 600, color: "#34D399" }}>
                  You&apos;re now on the {tierLabel(currentTier)} plan!
                </div>
                <div style={{ fontSize: "13px", color: "rgba(52,211,153,0.6)", marginTop: "2px" }}>
                  All {tierLabel(currentTier)} features are now active.
                  {currentTier === "professional" && " Context-Mapper is ready — upload your proposals to start building your moat."}
                  {currentTier === "gtm_agent" && " GTM Agent features are unlocked."}
                </div>
              </div>
              <button
                onClick={() => setUpgraded(false)}
                style={{ background: "none", border: "none", color: "rgba(52,211,153,0.4)", cursor: "pointer", fontSize: "18px" }}
              >×</button>
            </div>
          )}

          {/* Current plan badge */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "14px", padding: "20px 24px",
            marginBottom: "32px",
            animation: "billReveal 0.5s 0.05s ease both",
          }}>
            <div>
              <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.5)", marginBottom: "4px" }}>Current Plan</div>
              <div style={{
                fontFamily: "'Fraunces', serif", fontSize: "20px", fontWeight: 600, color: "#F8FAFC",
              }}>
                {tierLabel(currentTier)} <span style={{
                  fontFamily: "'Anybody', sans-serif",
                  fontSize: "14px", fontWeight: 400,
                  color: "rgba(148,163,184,0.5)",
                }}>· {tierPrice(currentTier)}</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
                color: "rgba(226,232,240,0.6)",
                fontSize: "13px", cursor: "pointer",
                transition: "all 0.2s",
              }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                onMouseLeave={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
              >
                Manage via Stripe
              </button>
              <button
                onClick={signOut}
                style={{
                  padding: "8px 16px", background: "none",
                  border: "none", color: "rgba(148,163,184,0.3)",
                  fontSize: "13px", cursor: "pointer",
                  transition: "color 0.2s",
                }}
                onMouseEnter={e => e.currentTarget.style.color = "rgba(248,113,113,0.7)"}
                onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.3)"}
              >
                Sign out
              </button>
            </div>
          </div>

          {/* Plan cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "16px",
            alignItems: "stretch",
          }}>
            {PLANS.map((plan, idx) => {
              const planRank = TIER_RANK[plan.id] ?? 0;
              const isCurrent = plan.id === currentTier;
              const isDowngrade = planRank < currentRank;
              const isUpgrade = planRank > currentRank;
              const isHighlight = plan.highlight && !isCurrent;

              return (
                <div
                  key={plan.id}
                  style={{
                    display: "flex", flexDirection: "column",
                    background: isHighlight
                      ? "linear-gradient(180deg, rgba(52,211,153,0.06) 0%, rgba(255,255,255,0.02) 100%)"
                      : "rgba(255,255,255,0.02)",
                    border: `1.5px solid ${isCurrent ? "rgba(99,102,241,0.4)" : isHighlight ? "rgba(52,211,153,0.25)" : "rgba(255,255,255,0.06)"}`,
                    borderRadius: "20px",
                    padding: "32px 28px",
                    position: "relative",
                    transition: "transform 0.25s, box-shadow 0.25s, border-color 0.25s",
                    animation: `billReveal 0.5s ${0.1 + idx * 0.08}s ease both`,
                    overflow: "hidden",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = isHighlight
                      ? "0 16px 48px rgba(52,211,153,0.12)"
                      : "0 12px 40px rgba(0,0,0,0.3)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                >
                  {/* Badge */}
                  {(isHighlight || isCurrent) && (
                    <div style={{
                      position: "absolute", top: "0", right: "0",
                      padding: "6px 14px",
                      borderBottomLeftRadius: "12px",
                      background: isCurrent ? "rgba(99,102,241,0.2)" : "rgba(52,211,153,0.15)",
                      fontFamily: "'Anybody', sans-serif",
                      fontSize: "10px", fontWeight: 600,
                      color: isCurrent ? "#A5B4FC" : "#34D399",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                    }}>
                      {isCurrent ? "Your Plan" : "Popular"}
                    </div>
                  )}

                  {/* Shine effect for highlighted */}
                  {isHighlight && (
                    <div style={{
                      position: "absolute", top: 0, left: "-100%",
                      width: "60%", height: "100%",
                      background: "linear-gradient(90deg, transparent, rgba(52,211,153,0.04), transparent)",
                      animation: "billShine 4s ease-in-out infinite",
                      pointerEvents: "none",
                    }} />
                  )}

                  <div style={{
                    fontFamily: "'Fraunces', serif",
                    fontSize: "22px", fontWeight: 700,
                    color: "#F8FAFC",
                    marginBottom: "4px",
                  }}>
                    {plan.name}
                  </div>
                  <div style={{ fontSize: "13px", color: "rgba(148,163,184,0.5)", marginBottom: "24px" }}>
                    {plan.description}
                  </div>

                  <div style={{ marginBottom: "28px" }}>
                    <span style={{
                      fontFamily: "'Anybody', sans-serif",
                      fontSize: "40px", fontWeight: 700,
                      color: "#F8FAFC",
                    }}>
                      {plan.price}
                    </span>
                    <span style={{
                      fontSize: "15px", color: "rgba(148,163,184,0.4)",
                      fontFamily: "'Anybody', sans-serif",
                    }}>
                      {plan.period}
                    </span>
                  </div>

                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "12px", marginBottom: "28px" }}>
                    {plan.features.map((f) => (
                      <div key={f} style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{
                          color: isHighlight ? "#34D399" : "#818CF8",
                          fontSize: "13px", marginTop: "1px", flexShrink: 0,
                        }}>✓</span>
                        <span style={{ fontSize: "13px", color: "rgba(226,232,240,0.6)", lineHeight: 1.4 }}>
                          {f}
                        </span>
                      </div>
                    ))}
                  </div>

                  {isCurrent ? (
                    <button
                      disabled
                      style={{
                        width: "100%", padding: "12px",
                        borderRadius: "10px",
                        border: "1.5px solid rgba(99,102,241,0.3)",
                        background: "rgba(99,102,241,0.06)",
                        color: "#A5B4FC",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "14px", fontWeight: 500,
                        cursor: "default",
                      }}
                    >
                      Current Plan
                    </button>
                  ) : isDowngrade ? (
                    <button
                      disabled
                      style={{
                        width: "100%", padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: "rgba(255,255,255,0.03)",
                        color: "rgba(148,163,184,0.3)",
                        fontSize: "13px", cursor: "default",
                      }}
                    >
                      Downgrade — contact support
                    </button>
                  ) : (
                    <button
                      onClick={() => plan.ctaAction && handleUpgrade(plan.ctaAction)}
                      disabled={loading || !isUpgrade}
                      style={{
                        width: "100%", padding: "12px",
                        borderRadius: "10px",
                        border: "none",
                        background: isHighlight
                          ? "linear-gradient(135deg, #059669, #34D399)"
                          : "linear-gradient(135deg, #6366F1, #818CF8)",
                        color: "#fff",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "14px", fontWeight: 600,
                        cursor: loading ? "not-allowed" : "pointer",
                        opacity: loading ? 0.5 : 1,
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = isHighlight ? "0 8px 24px rgba(52,211,153,0.3)" : "0 8px 24px rgba(99,102,241,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      {loading ? "Redirecting…" : plan.cta}
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <p style={{
            textAlign: "center", marginTop: "32px",
            fontSize: "12px", color: "rgba(148,163,184,0.25)",
          }}>
            All plans include 14-day free trial. Cancel anytime. Downgrade or cancellation requests handled via support.
          </p>

          <div style={{ textAlign: "center", marginTop: "24px" }}>
            <Link href="/dashboard" style={{
              fontSize: "13px", color: "rgba(148,163,184,0.4)",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.color = "rgba(148,163,184,0.7)"}
              onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.4)"}
            >
              ← Back to Dashboard
            </Link>
          </div>
        </main>
      </div>
    </>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
