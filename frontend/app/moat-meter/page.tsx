"use client";

/**
 * Screen 4: Moat Meter — Real-Time Switching Cost Visualizer.
 * Makes the invisible switching cost visible.
 * Primary retention mechanism in Months 3-6.
 * Keeps dark navy background for dramatic effect.
 * #4: Industry benchmark tick mark on gauge arc.
 */
import { useEffect, useState } from "react";
import { contextMapperApi, analyticsApi } from "@/lib/api";
import { CMStatus, IndustryBenchmark } from "@/lib/types";

const MILESTONES = [
  { label: "Onboarding", months: 0, cost: 2000, proposals: 10 },
  { label: "Learning", months: 1, cost: 5000, proposals: 25 },
  { label: "Embedded", months: 3, cost: 18000, proposals: 100 },
  { label: "Entrenched", months: 6, cost: 33000, proposals: 250 },
  { label: "Irreplaceable", months: 9, cost: 80000, proposals: 500 },
];

function formatCurrency(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}K+`;
  return `$${n.toLocaleString()}`;
}

function GaugeArc({
  percentage,
  benchmarkPct,
}: {
  percentage: number;
  benchmarkPct: number | null;
}) {
  const radius = 80;
  const circumference = Math.PI * radius;
  const strokeDashoffset = circumference * (1 - Math.min(percentage, 1));

  // Convert percent along arc to (x,y) on the semicircle.
  // Arc goes from left (180°) to right (0°), so angle = 180° - pct*180°
  function arcPoint(pct: number) {
    const angle = Math.PI - pct * Math.PI; // 0→left, 1→right
    const cx = 100;
    const cy = 100;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  }

  const bp = benchmarkPct !== null ? arcPoint(benchmarkPct) : null;

  return (
    <svg viewBox="0 0 200 110" className="w-full max-w-xs mx-auto">
      {/* Background arc */}
      <path
        d="M 10 100 A 90 90 0 0 1 190 100"
        fill="none"
        stroke="#1f2937"
        strokeWidth="16"
        strokeLinecap="round"
      />
      {/* Value arc */}
      <path
        d="M 10 100 A 90 90 0 0 1 190 100"
        fill="none"
        stroke="#6366F1"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-1000"
      />
      {/* Industry benchmark tick */}
      {bp && (
        <>
          <line
            x1={bp.x - 6 * Math.cos(Math.PI - benchmarkPct! * Math.PI)}
            y1={bp.y + 6 * Math.sin(Math.PI - benchmarkPct! * Math.PI)}
            x2={bp.x + 6 * Math.cos(Math.PI - benchmarkPct! * Math.PI)}
            y2={bp.y - 6 * Math.sin(Math.PI - benchmarkPct! * Math.PI)}
            stroke="#F59E0B"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <text
            x={bp.x}
            y={bp.y - 12}
            textAnchor="middle"
            fill="#F59E0B"
            fontSize="7"
            fontFamily="JetBrains Mono, monospace"
          >
            Industry avg
          </text>
        </>
      )}
    </svg>
  );
}

export default function MoatMeterPage() {
  const [data, setData] = useState<CMStatus | null>(null);
  const [benchmark, setBenchmark] = useState<IndustryBenchmark | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      contextMapperApi.status().then((d) => setData(d as CMStatus)),
      analyticsApi.industryBenchmark().then((d) => setBenchmark(d as IndustryBenchmark)).catch(() => {}),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse" style={{ color: "#6366F1" }}>Loading your moat data…</div>
      </div>
    );
  }

  const sc = data?.switching_cost ?? { total_cost: 0, human_hours: 0, months_active: 0, proposals_indexed: 0, milestone: "onboarding" };
  const proposalsIndexed = sc.proposals_indexed ?? 0;
  const totalCost = sc.total_cost ?? 0;
  const humanHours = sc.human_hours ?? 0;
  const monthsActive = sc.months_active ?? 0;
  const milestone = sc.milestone ?? "onboarding";

  const maxCost = 80000;
  const gaugePercent = Math.min(totalCost / maxCost, 1);
  const benchmarkPct = benchmark ? Math.min(benchmark.avg_switching_cost_usd / maxCost, 1) : null;

  const milestoneIndex = MILESTONES.findIndex((m) => monthsActive < m.months);
  const currentMilestone = milestoneIndex === -1 ? 4 : Math.max(0, milestoneIndex - 1);
  const nextMilestone = MILESTONES[Math.min(currentMilestone + 1, MILESTONES.length - 1)];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6" style={{ fontFamily: "DM Sans, system-ui, sans-serif" }}>
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
            Your Context-Mapper Moat
          </h1>
          <p className="text-gray-400">
            How much it would cost a competitor to replicate your institutional memory
          </p>
        </div>

        {/* Gauge */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 mb-6 text-center">
          <GaugeArc percentage={gaugePercent} benchmarkPct={benchmarkPct} />
          <div className="mt-2">
            <div className="text-5xl font-bold font-mono" style={{ color: "#6366F1" }}>
              {formatCurrency(totalCost)}
            </div>
            <div className="text-gray-400 text-sm mt-1">to rebuild elsewhere</div>
          </div>
          {benchmark && (
            <div className="mt-3 text-sm" style={{ color: "#F59E0B" }}>
              Industry avg ({benchmark.benchmark_label}): {formatCurrency(benchmark.avg_switching_cost_usd)}
            </div>
          )}
          <div className="mt-3 inline-block px-4 py-1 rounded-full text-sm font-medium capitalize" style={{ background: "rgba(99,102,241,0.2)", color: "#A5B4FC" }}>
            {milestone}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold font-mono text-white">{proposalsIndexed}</div>
            <div className="text-xs text-gray-500 mt-1">Proposals indexed</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold font-mono text-white">{humanHours}h</div>
            <div className="text-xs text-gray-500 mt-1">Institutional knowledge</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold font-mono text-white">{monthsActive}mo</div>
            <div className="text-xs text-gray-500 mt-1">Active months</div>
          </div>
        </div>

        {/* Milestone timeline */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4 uppercase tracking-wider">
            Switching Cost Growth
          </h3>
          <div className="space-y-3">
            {MILESTONES.map((m, i) => {
              const isReached = monthsActive >= m.months;
              const isCurrent = i === currentMilestone;
              return (
                <div key={m.label} className="flex items-center gap-3">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isCurrent ? "ring-2 ring-offset-2 ring-offset-gray-900" : ""
                    }`}
                    style={{
                      background: isReached ? "#6366F1" : "#374151",
                      ringColor: isReached ? "#6366F1" : undefined,
                    }}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span className={`text-sm ${isReached ? "text-white" : "text-gray-500"}`}>
                      {m.label}
                    </span>
                    <span className={`text-sm font-mono ${isReached ? "" : "text-gray-600"}`} style={{ color: isReached ? "#6366F1" : undefined }}>
                      {formatCurrency(m.cost)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Next milestone CTA */}
        {nextMilestone && (
          <div className="border rounded-xl p-5" style={{ background: "rgba(99,102,241,0.12)", borderColor: "rgba(99,102,241,0.4)" }}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium mb-1" style={{ color: "#A5B4FC" }}>
                  Next milestone: {nextMilestone.label}
                </div>
                <div className="text-sm" style={{ color: "#818CF8" }}>
                  Upload {Math.max(0, nextMilestone.proposals - proposalsIndexed)} more proposals
                  to reach {formatCurrency(nextMilestone.cost)} switching cost
                </div>
              </div>
              <a
                href="/onboarding"
                className="text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ml-4 transition-colors"
                style={{ background: "#6366F1" }}
              >
                Upload →
              </a>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-xs text-gray-600">
          Switching cost = ({humanHours} hours × $39/hr labor) + ({monthsActive} months × $500 intelligence value)
        </div>
      </div>
    </div>
  );
}
