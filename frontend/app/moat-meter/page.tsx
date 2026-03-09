"use client";

/**
 * Screen 4: Moat Meter — Real-Time Switching Cost Visualizer.
 * Makes the invisible switching cost visible.
 * Primary retention mechanism in Months 3-6.
 */
import { useEffect, useState } from "react";
import { contextMapperApi } from "@/lib/api";

// Milestone thresholds (from financial model)
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

function GaugeArc({ percentage }: { percentage: number }) {
  const radius = 80;
  const circumference = Math.PI * radius; // half circle
  const strokeDashoffset = circumference * (1 - Math.min(percentage, 1));

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
        stroke="#00BFA5"
        strokeWidth="16"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        className="transition-all duration-1000"
      />
    </svg>
  );
}

export default function MoatMeterPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    contextMapperApi
      .status()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-teal-400 animate-pulse">Loading your moat data…</div>
      </div>
    );
  }

  const sc = data?.switching_cost ?? {};
  const proposalsIndexed = sc.proposals_indexed ?? 0;
  const totalCost = sc.total_cost ?? 0;
  const humanHours = sc.human_hours ?? 0;
  const monthsActive = sc.months_active ?? 0;
  const milestone = sc.milestone ?? "onboarding";

  // Progress through milestones
  const maxCost = 80000;
  const gaugePercent = Math.min(totalCost / maxCost, 1);

  // Current milestone index
  const milestoneIndex = MILESTONES.findIndex(
    (m) => monthsActive < m.months
  );
  const currentMilestone = milestoneIndex === -1 ? 4 : Math.max(0, milestoneIndex - 1);
  const nextMilestone = MILESTONES[Math.min(currentMilestone + 1, MILESTONES.length - 1)];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">
            Your Context-Mapper Moat
          </h1>
          <p className="text-gray-400">
            How much it would cost a competitor to replicate your institutional memory
          </p>
        </div>

        {/* Gauge */}
        <div className="bg-gray-900 rounded-2xl border border-gray-800 p-8 mb-6 text-center">
          <GaugeArc percentage={gaugePercent} />
          <div className="mt-2">
            <div className="text-5xl font-bold text-teal-400">
              {formatCurrency(totalCost)}
            </div>
            <div className="text-gray-400 text-sm mt-1">to rebuild elsewhere</div>
          </div>
          <div className="mt-4 inline-block bg-teal-900 text-teal-300 px-4 py-1 rounded-full text-sm font-medium capitalize">
            {milestone}
          </div>
        </div>

        {/* Metric cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-white">{proposalsIndexed}</div>
            <div className="text-xs text-gray-500 mt-1">Proposals indexed</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-white">{humanHours}h</div>
            <div className="text-xs text-gray-500 mt-1">Institutional knowledge</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 text-center">
            <div className="text-2xl font-bold text-white">{monthsActive}mo</div>
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
                      isReached ? "bg-teal-400" : "bg-gray-700"
                    } ${isCurrent ? "ring-2 ring-teal-400 ring-offset-2 ring-offset-gray-900" : ""}`}
                  />
                  <div className="flex-1 flex items-center justify-between">
                    <span
                      className={`text-sm ${isReached ? "text-white" : "text-gray-500"}`}
                    >
                      {m.label}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        isReached ? "text-teal-400" : "text-gray-600"
                      }`}
                    >
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
          <div className="bg-teal-900 border border-teal-700 rounded-xl p-5">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-teal-300 font-medium mb-1">
                  Next milestone: {nextMilestone.label}
                </div>
                <div className="text-sm text-teal-400">
                  Upload {Math.max(0, nextMilestone.proposals - proposalsIndexed)} more proposals
                  to reach {formatCurrency(nextMilestone.cost)} switching cost
                </div>
              </div>
              <a
                href="/onboarding"
                className="bg-teal-500 hover:bg-teal-400 text-white px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap ml-4"
              >
                Upload →
              </a>
            </div>
          </div>
        )}

        {/* What this means */}
        <div className="mt-6 text-center text-xs text-gray-600">
          Switching cost = ({humanHours} hours × $39/hr labor) + ({monthsActive} months × $500 intelligence value)
        </div>
      </div>
    </div>
  );
}
