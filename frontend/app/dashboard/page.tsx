"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi, contextMapperApi, proposalsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import AppNav from "@/app/components/AppNav";
import { UnitEconomics, WinRate, PhaseGate, CMStatus, Proposal, Gate } from "@/lib/types";

const METRICS_CONFIG = [
  { key: "monthly_churn_rate", label: "Monthly Churn", format: (v: number) => `${(v * 100).toFixed(1)}%`, alarm: 0.062, target: "≤5.5% by M3" },
  { key: "ltv_usd", label: "LTV", format: (v: number) => `$${v.toFixed(0)}`, alarm: null, target: "Growing with churn drop" },
  { key: "blended_arpa_usd", label: "Blended ARPA", format: (v: number) => `$${v.toFixed(0)}/mo`, alarm: null, target: "$175 base" },
  { key: "gross_margin", label: "Gross Margin", format: (v: number) => `${(v * 100).toFixed(0)}%`, alarm: 0.68, target: ">72% by M6" },
  { key: "ai_cost_per_proposal", label: "AI Cost/Proposal", format: (v: number) => `$${v.toFixed(2)}`, alarm: 0.25, target: "<$0.15 by M6" },
  { key: "avg_switching_cost_usd", label: "Avg Switching Cost", format: (v: number) => `$${v.toFixed(0)}`, alarm: null, target: "Growing →" },
] as const;

function MetricCard({ config, value }: { config: typeof METRICS_CONFIG[number]; value: number }) {
  const alarm = config.alarm;
  const isAlarming = alarm !== null && value >= alarm;
  return (
    <div
      className="bg-white border rounded-xl p-4 card-hover"
      style={{ borderColor: isAlarming ? "#FECACA" : "var(--vellum-border)", background: isAlarming ? "#FFF5F5" : "white" }}
    >
      <div className="text-xs mb-1 uppercase tracking-wide" style={{ color: "var(--ink-muted)" }}>{config.label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color: isAlarming ? "#DC2626" : "var(--ink-primary)" }}>
        {config.format(value)}
      </div>
      <div className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>{config.target}</div>
      {isAlarming && (
        <div className="text-xs text-red-500 mt-1 font-medium">⚠ Above alarm threshold</div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [unitEcon, setUnitEcon] = useState<UnitEconomics | null>(null);
  const [winRate, setWinRate] = useState<WinRate | null>(null);
  const [phaseGate, setPhaseGate] = useState<PhaseGate | null>(null);
  const [cmStatus, setCmStatus] = useState<CMStatus | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.unitEconomics().then((d) => setUnitEcon(d as UnitEconomics)),
      analyticsApi.winRate().then((d) => setWinRate(d as WinRate)),
      analyticsApi.phaseGate().then((d) => setPhaseGate(d as PhaseGate)),
      contextMapperApi.status().then((d) => setCmStatus(d as CMStatus)),
      proposalsApi.list().then((p) => setProposals((p as Proposal[]).slice(0, 5))),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const isGtm = user?.tier === "gtm_agent";

  return (
    <div className="min-h-screen" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Financial metrics */}
        <div className="fade-up">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Financial Metrics</h2>
            <div className="text-xs" style={{ color: "var(--ink-muted)" }}>
              Scenario:{" "}
              <span
                className="font-medium font-mono"
                style={{
                  color:
                    unitEcon?.on_track_for === "bull"
                      ? "#F59E0B"
                      : unitEcon?.on_track_for === "base"
                      ? "#6366F1"
                      : "#EF4444",
                }}
              >
                {unitEcon?.on_track_for?.toUpperCase() ?? "—"} CASE
              </span>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border rounded-xl p-4 h-24 animate-pulse" style={{ borderColor: "var(--vellum-border)" }} />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {METRICS_CONFIG.map((config) => (
                <MetricCard
                  key={config.key}
                  config={config}
                  value={unitEcon?.[config.key] ?? 0}
                />
              ))}
            </div>
          )}
        </div>

        {/* Win rate + Context-Mapper */}
        <div className="grid grid-cols-2 gap-6 fade-up-1">
          {/* Win rate */}
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: "var(--vellum-border)" }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Win Rate</h3>
            {winRate ? (
              <div className="space-y-3">
                <div className="text-4xl font-bold font-mono" style={{ color: "var(--indigo)" }}>
                  {((winRate.win_rate ?? 0) * 100).toFixed(0)}%
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold font-mono" style={{ color: "var(--ink-primary)" }}>{winRate.total_proposals}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Total</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold font-mono text-green-600">{winRate.won}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Won</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold font-mono text-red-400">{winRate.lost}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Lost</div>
                  </div>
                </div>
                <div className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                  Avg deal size: <strong className="font-mono">${winRate.avg_deal_size_usd?.toFixed(0)}</strong>
                </div>
              </div>
            ) : (
              <div className="animate-pulse" style={{ color: "var(--ink-muted)" }}>Loading…</div>
            )}
          </div>

          {/* Context-Mapper status */}
          <div className="bg-white border rounded-xl p-5" style={{ borderColor: "var(--vellum-border)" }}>
            <h3 className="font-bold mb-4" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Context-Mapper</h3>
            {cmStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: cmStatus.context_mapper_active ? "#10B981" : "#CBD5E1" }}
                  />
                  <span className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                    {cmStatus.context_mapper_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold font-mono" style={{ color: "var(--ink-primary)" }}>{cmStatus.proposals_indexed}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Proposals</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold font-mono" style={{ color: "var(--ink-primary)" }}>{cmStatus.pricing_rows}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Pricing rows</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold font-mono" style={{ color: "var(--ink-primary)" }}>{cmStatus.brand_examples}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>Brand examples</div>
                  </div>
                </div>

                {/* Milestone progress bar */}
                {cmStatus.milestone_progress_pct !== undefined && cmStatus.next_milestone && (
                  <div className="mt-2">
                    <div className="flex justify-between text-xs mb-1" style={{ color: "var(--ink-secondary)" }}>
                      <span>Next: <strong>{cmStatus.next_milestone}</strong></span>
                      <span className="font-mono">{Math.round(cmStatus.milestone_progress_pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--vellum-border)" }}>
                      <div
                        className="h-1.5 rounded-full transition-all duration-700"
                        style={{ width: `${cmStatus.milestone_progress_pct}%`, background: "var(--indigo)" }}
                      />
                    </div>
                    {cmStatus.proposals_to_next_milestone !== undefined && (
                      <p className="text-xs mt-1" style={{ color: "var(--ink-muted)" }}>
                        {cmStatus.proposals_to_next_milestone} proposals to next milestone
                        {cmStatus.estimated_days_to_milestone !== undefined && cmStatus.estimated_days_to_milestone > 0
                          ? ` · ~${cmStatus.estimated_days_to_milestone}d`
                          : ""}
                      </p>
                    )}
                  </div>
                )}

                <Link
                  href="/moat-meter"
                  className="inline-block text-xs hover:underline"
                  style={{ color: "var(--indigo)" }}
                >
                  View Moat Meter →
                </Link>
              </div>
            ) : (
              <div className="animate-pulse" style={{ color: "var(--ink-muted)" }}>Loading…</div>
            )}
          </div>
        </div>

        {/* GTM quick links — for gtm_agent tier */}
        {isGtm && (
          <div className="grid grid-cols-3 gap-4 fade-up-2">
            {[
              { href: "/gtm/meeting-signals", label: "Meeting Signals", desc: "Extract CRM signals from call notes" },
              { href: "/gtm/outreach", label: "Outreach Sequences", desc: "Generate personalized email drip" },
              { href: "/gtm", label: "Deal Pipeline", desc: "Drag-and-drop Kanban board" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="bg-white border rounded-xl p-4 card-hover block"
                style={{ borderColor: "var(--vellum-border)" }}
              >
                <div className="font-semibold text-sm mb-1" style={{ color: "var(--ink-primary)" }}>{item.label}</div>
                <div className="text-xs" style={{ color: "var(--ink-secondary)" }}>{item.desc}</div>
              </Link>
            ))}
          </div>
        )}

        {/* Phase gate */}
        {phaseGate && (
          <div className="bg-white border rounded-xl p-5 fade-up-2" style={{ borderColor: "var(--vellum-border)" }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Phase 1 → 2 Gate</h3>
              <span
                className="text-xs px-2 py-1 rounded-full font-medium"
                style={{
                  background: phaseGate.all_passed ? "rgba(16,185,129,0.1)" : "rgba(0,0,0,0.05)",
                  color: phaseGate.all_passed ? "#059669" : "var(--ink-secondary)",
                }}
              >
                {phaseGate.all_passed ? "GTM Agent Unlocked" : "Phase 1 in progress"}
              </span>
            </div>
            <div className="space-y-2">
              {([phaseGate.gate1, phaseGate.gate2, phaseGate.gate3] as Gate[]).map((gate) => (
                <div key={gate.label} className="flex items-center gap-3">
                  <span className={`text-lg ${gate.passed ? "text-green-500" : "text-gray-300"}`}>
                    {gate.passed ? "✓" : "○"}
                  </span>
                  <span className="text-sm flex-1" style={{ color: "var(--ink-secondary)" }}>{gate.label}</span>
                  <span className="text-xs font-mono" style={{ color: "var(--ink-muted)" }}>
                    {gate.current} / {gate.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent proposals */}
        <div className="bg-white border rounded-xl p-5 fade-up-3" style={{ borderColor: "var(--vellum-border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Recent Proposals</h3>
            <Link href="/proposals" className="text-xs hover:underline" style={{ color: "var(--indigo)" }}>
              View all →
            </Link>
          </div>
          {proposals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">✦</div>
              <h4 className="font-bold text-lg mb-2" style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--ink-primary)" }}>
                Your first proposal is one click away
              </h4>
              <p className="text-sm mb-5 max-w-xs mx-auto" style={{ color: "var(--ink-secondary)" }}>
                Generate a tailored proposal in under 60 seconds. Each one teaches Context-Mapper how your firm sells.
              </p>
              <Link
                href="/proposals/new"
                className="inline-block text-sm font-medium px-5 py-2.5 rounded-xl text-white"
                style={{ background: "var(--indigo)" }}
              >
                ✦ Generate your first proposal
              </Link>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: "var(--vellum-border)" }}>
              {proposals.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm" style={{ color: "var(--ink-primary)" }}>{p.title || "Untitled"}</div>
                    <div className="text-xs" style={{ color: "var(--ink-muted)" }}>{p.client_name || "—"}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.value_usd && (
                      <span className="text-sm font-mono" style={{ color: "var(--ink-secondary)" }}>${p.value_usd.toLocaleString()}</span>
                    )}
                    {p.outcome === "pending" ? (
                      <>
                        <button
                          onClick={async () => {
                            const reason = prompt("What helped you win this deal?");
                            if (reason === null) return;
                            try {
                              await proposalsApi.update(p.id, { outcome: "won", win_reason: reason });
                              setProposals((prev) =>
                                prev.map((x) => (x.id === p.id ? { ...x, outcome: "won" as const } : x))
                              );
                            } catch (e) { console.error(e); }
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 hover:bg-green-200 font-medium transition-colors"
                        >
                          Won ✓
                        </button>
                        <button
                          onClick={async () => {
                            const reason = prompt("Why was this deal lost?");
                            if (reason === null) return;
                            try {
                              await proposalsApi.update(p.id, { outcome: "lost", lose_reason: reason });
                              setProposals((prev) =>
                                prev.map((x) => (x.id === p.id ? { ...x, outcome: "lost" as const } : x))
                              );
                            } catch (e) { console.error(e); }
                          }}
                          className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-500 hover:bg-red-200 font-medium transition-colors"
                        >
                          Lost ✗
                        </button>
                      </>
                    ) : (
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          background: p.outcome === "won" ? "rgba(16,185,129,0.1)" : p.outcome === "lost" ? "rgba(239,68,68,0.1)" : "rgba(0,0,0,0.05)",
                          color: p.outcome === "won" ? "#059669" : p.outcome === "lost" ? "#DC2626" : "var(--ink-muted)",
                        }}
                      >
                        {p.outcome ?? "pending"}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
