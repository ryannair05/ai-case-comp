"use client";

/**
 * Screen 2: Main Dashboard.
 * Churn-first analytics. Financial metrics in priority order.
 * Priya's primary tool.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { analyticsApi, contextMapperApi, proposalsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const METRICS_CONFIG = [
  { key: "monthly_churn_rate", label: "Monthly Churn", format: (v: number) => `${(v * 100).toFixed(1)}%`, alarm: 0.062, target: "≤5.5% by M3" },
  { key: "ltv_usd", label: "LTV", format: (v: number) => `$${v.toFixed(0)}`, alarm: null, target: "Growing with churn drop" },
  { key: "blended_arpa_usd", label: "Blended ARPA", format: (v: number) => `$${v.toFixed(0)}/mo`, alarm: null, target: "$175 base" },
  { key: "gross_margin", label: "Gross Margin", format: (v: number) => `${(v * 100).toFixed(0)}%`, alarm: 0.68, target: ">72% by M6" },
  { key: "ai_cost_per_proposal", label: "AI Cost/Proposal", format: (v: number) => `$${v.toFixed(2)}`, alarm: 0.25, target: "<$0.15 by M6" },
  { key: "avg_switching_cost_usd", label: "Avg Switching Cost", format: (v: number) => `$${v.toFixed(0)}`, alarm: null, target: "Growing →" },
];

function MetricCard({ config, value }: { config: typeof METRICS_CONFIG[0]; value: number }) {
  const isAlarming = config.alarm !== null && value >= config.alarm;
  return (
    <div className={`bg-white border rounded-xl p-4 ${isAlarming ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
      <div className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{config.label}</div>
      <div className={`text-2xl font-bold ${isAlarming ? "text-red-600" : "text-gray-900"}`}>
        {config.format(value)}
      </div>
      <div className="text-xs text-gray-400 mt-1">{config.target}</div>
      {isAlarming && (
        <div className="text-xs text-red-500 mt-1 font-medium">⚠ Above alarm threshold</div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { signOut } = useAuth();
  const [unitEcon, setUnitEcon] = useState<any>(null);
  const [winRate, setWinRate] = useState<any>(null);
  const [phaseGate, setPhaseGate] = useState<any>(null);
  const [cmStatus, setCmStatus] = useState<any>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.unitEconomics().then(setUnitEcon),
      analyticsApi.winRate().then(setWinRate),
      analyticsApi.phaseGate().then(setPhaseGate),
      contextMapperApi.status().then(setCmStatus),
      proposalsApi.list().then((p) => setProposals(p.slice(0, 5))),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-teal-600 font-bold text-xl">Draftly</span>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/dashboard" className="text-teal-600 font-medium">Dashboard</Link>
          <Link href="/moat-meter">Moat Meter</Link>
          <Link href="/onboarding">Upload</Link>
          <Link href="/roi-email">ROI Report</Link>
          <Link href="/demo">Demo</Link>
          <button
            onClick={signOut}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Financial metrics — churn first */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Financial Metrics</h2>
            <div className="text-xs text-gray-400">
              Scenario:{" "}
              <span
                className={`font-medium ${
                  unitEcon?.on_track_for === "bull"
                    ? "text-amber-500"
                    : unitEcon?.on_track_for === "base"
                    ? "text-teal-500"
                    : "text-red-500"
                }`}
              >
                {unitEcon?.on_track_for?.toUpperCase() ?? "—"} CASE
              </span>
            </div>
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white border border-gray-100 rounded-xl p-4 h-24 animate-pulse" />
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
        <div className="grid grid-cols-2 gap-6">
          {/* Win rate */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4">Win Rate</h3>
            {winRate ? (
              <div className="space-y-3">
                <div className="text-4xl font-bold text-teal-500">
                  {((winRate.win_rate ?? 0) * 100).toFixed(0)}%
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-gray-900">{winRate.total_proposals}</div>
                    <div className="text-gray-400 text-xs">Total</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-green-600">{winRate.won}</div>
                    <div className="text-gray-400 text-xs">Won</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-red-400">{winRate.lost}</div>
                    <div className="text-gray-400 text-xs">Lost</div>
                  </div>
                </div>
                <div className="text-sm text-gray-500">
                  Avg deal size: <strong>${winRate.avg_deal_size_usd?.toFixed(0)}</strong>
                </div>
              </div>
            ) : (
              <div className="text-gray-300 animate-pulse">Loading…</div>
            )}
          </div>

          {/* Context-Mapper status */}
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <h3 className="font-bold text-gray-900 mb-4">Context-Mapper</h3>
            {cmStatus ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      cmStatus.context_mapper_active ? "bg-teal-500" : "bg-gray-300"
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {cmStatus.context_mapper_active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center">
                    <div className="font-bold text-gray-900">{cmStatus.proposals_indexed}</div>
                    <div className="text-gray-400 text-xs">Proposals</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900">{cmStatus.pricing_rows}</div>
                    <div className="text-gray-400 text-xs">Pricing rows</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-gray-900">{cmStatus.brand_examples}</div>
                    <div className="text-gray-400 text-xs">Brand examples</div>
                  </div>
                </div>
                <Link
                  href="/moat-meter"
                  className="inline-block text-xs text-teal-600 hover:underline"
                >
                  View Moat Meter →
                </Link>
              </div>
            ) : (
              <div className="text-gray-300 animate-pulse">Loading…</div>
            )}
          </div>
        </div>

        {/* Phase gate */}
        {phaseGate && (
          <div className="bg-white border border-gray-100 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Phase 1 → 2 Gate</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  phaseGate.all_passed ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {phaseGate.all_passed ? "GTM Agent Unlocked" : "Phase 1 in progress"}
              </span>
            </div>
            <div className="space-y-2">
              {[phaseGate.gate1, phaseGate.gate2, phaseGate.gate3].map((gate: any) => (
                <div key={gate.label} className="flex items-center gap-3">
                  <span className={`text-lg ${gate.passed ? "text-green-500" : "text-gray-300"}`}>
                    {gate.passed ? "✓" : "○"}
                  </span>
                  <span className="text-sm text-gray-700 flex-1">{gate.label}</span>
                  <span className="text-xs text-gray-400">
                    {gate.current} / {gate.target}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent proposals */}
        <div className="bg-white border border-gray-100 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-900">Recent Proposals</h3>
            <Link href="/proposals" className="text-xs text-teal-600 hover:underline">
              View all →
            </Link>
          </div>
          {proposals.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">
              No proposals yet.{" "}
              <Link href="/proposals/new" className="text-teal-600 hover:underline">
                Generate your first →
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {proposals.map((p) => (
                <div key={p.id} className="py-3 flex items-center justify-between">
                  <div>
                    <div className="font-medium text-gray-900 text-sm">{p.title || "Untitled"}</div>
                    <div className="text-xs text-gray-400">{p.client_name || "—"}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    {p.value_usd && (
                      <span className="text-sm text-gray-700">${p.value_usd.toLocaleString()}</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        p.outcome === "won"
                          ? "bg-green-100 text-green-700"
                          : p.outcome === "lost"
                          ? "bg-red-100 text-red-500"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {p.outcome ?? "pending"}
                    </span>
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
