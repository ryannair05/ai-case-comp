"use client";

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

  // Detect ?success=true (Stripe webhook simulation)
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
    <div className="min-h-screen flex flex-col" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <main className="max-w-5xl mx-auto w-full p-6 py-12 flex-1">
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
          Billing &amp; Subscription
        </h1>
        <p className="mb-8" style={{ color: "var(--ink-secondary)" }}>
          Manage your plan, billing history, and payment methods.
        </p>

        {/* Post-upgrade success banner */}
        {upgraded && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 mb-8 flex items-start gap-4">
            <span className="text-green-500 text-2xl mt-0.5">✓</span>
            <div>
              <div className="font-semibold text-green-900 text-base">
                You&apos;re now on the {tierLabel(currentTier)} plan!
              </div>
              <div className="text-sm text-green-700 mt-1">
                Your subscription has been upgraded. All {tierLabel(currentTier)} features are now active.
                {currentTier === "professional" && " Context-Mapper is ready — upload your proposals to start building your moat."}
                {currentTier === "gtm_agent" && " GTM Agent features are unlocked. Head to Meeting Signals to get started."}
              </div>
              <button
                onClick={() => setUpgraded(false)}
                className="text-xs text-green-600 hover:text-green-800 mt-2 underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Current plan card */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8 flex items-center justify-between" style={{ borderColor: "var(--vellum-border)" }}>
          <div>
            <h2 className="text-xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              Current Plan:{" "}
              <span style={{ color: "var(--indigo)" }}>{tierLabel(currentTier)}</span>
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
              {tierPrice(currentTier)} · billed monthly via Stripe
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors" style={{ color: "var(--ink-primary)" }}>
              Manage via Stripe
            </button>
            <button
              onClick={signOut}
              className="text-sm transition-colors"
              style={{ color: "var(--ink-muted)" }}
            >
              Sign out
            </button>
          </div>
        </div>

        <h3 className="text-lg font-bold mb-4" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
          Available Plans
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const planRank = TIER_RANK[plan.id] ?? 0;
            const isCurrent = plan.id === currentTier;
            const isDowngrade = planRank < currentRank;
            const isUpgrade = planRank > currentRank;

            return (
              <div
                key={plan.id}
                className={`bg-white border rounded-xl p-6 flex flex-col relative card-hover ${
                  isCurrent ? "border-2 shadow-md" : ""
                }`}
                style={{
                  borderColor: isCurrent ? "var(--indigo)" : plan.highlight && !isCurrent ? "var(--indigo)" : "var(--vellum-border)",
                  borderWidth: isCurrent || (plan.highlight && !isCurrent) ? "2px" : "1px",
                }}
              >
                {plan.highlight && !isCurrent && (
                  <div className="absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg" style={{ background: "var(--indigo)" }}>
                    POPULAR
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute top-0 right-0 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg" style={{ background: "var(--indigo)" }}>
                    YOUR PLAN
                  </div>
                )}

                <div className="font-bold text-xl mb-1" style={{ fontFamily: "Fraunces, Georgia, serif" }}>{plan.name}</div>
                <div className="mb-4 text-sm" style={{ color: "var(--ink-secondary)" }}>{plan.description}</div>
                <div className="text-3xl font-extrabold mb-6 font-mono" style={{ color: "var(--ink-primary)" }}>
                  {plan.price}
                  <span className="text-lg font-normal" style={{ color: "var(--ink-muted)" }}>{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm" style={{ color: "var(--ink-secondary)" }}>
                      <span className="mt-0.5" style={{ color: "var(--indigo)" }}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button
                    disabled
                    className="w-full py-2 rounded-lg font-medium border"
                    style={{ background: "rgba(99,102,241,0.07)", color: "var(--indigo)", borderColor: "rgba(99,102,241,0.3)" }}
                  >
                    Current Plan
                  </button>
                ) : isDowngrade ? (
                  <button
                    disabled
                    className="w-full py-2 bg-gray-100 text-gray-400 rounded-lg font-medium text-sm"
                  >
                    Downgrade — contact support
                  </button>
                ) : (
                  <button
                    onClick={() => plan.ctaAction && handleUpgrade(plan.ctaAction)}
                    disabled={loading || !isUpgrade}
                    className="w-full py-2 rounded-lg font-medium transition-colors text-sm text-white disabled:opacity-50"
                    style={{ background: "var(--indigo)" }}
                  >
                    {loading ? "Redirecting…" : plan.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="text-xs mt-6 text-center" style={{ color: "var(--ink-muted)" }}>
          All plans include 14-day free trial. Cancel anytime. Downgrade or cancellation requests handled via support.
        </p>

        <div className="mt-8 text-center">
          <Link href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--ink-secondary)" }}>
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense fallback={null}>
      <BillingInner />
    </Suspense>
  );
}
