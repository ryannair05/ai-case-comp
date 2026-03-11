"use client";

/**
 * Screen 4: Moat Meter — Real-Time Switching Cost Visualizer.
 * Aesthetic: Cinematic data theater — dark with dramatic neon gauge glow.
 * Typography: Syne (geometric brutalist) for headings, Anybody for data.
 */
import { useEffect, useState } from "react";
import { contextMapperApi, analyticsApi } from "@/lib/api";
import { CMStatus, IndustryBenchmark } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

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

  function arcPoint(pct: number) {
    const angle = Math.PI - pct * Math.PI;
    const cx = 100;
    const cy = 100;
    return {
      x: cx + radius * Math.cos(angle),
      y: cy - radius * Math.sin(angle),
    };
  }

  const bp = benchmarkPct !== null ? arcPoint(benchmarkPct) : null;

  return (
    <svg viewBox="0 0 200 115" style={{ width: "100%", maxWidth: "320px", margin: "0 auto", display: "block" }}>
      {/* Outer glow */}
      <defs>
        <filter id="gaugeGlow">
          <feGaussianBlur stdDeviation="4" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
        <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#06B6D4" />
          <stop offset="50%" stopColor="#818CF8" />
          <stop offset="100%" stopColor="#E879F9" />
        </linearGradient>
      </defs>
      {/* Background arc */}
      <path
        d="M 10 100 A 90 90 0 0 1 190 100"
        fill="none"
        stroke="rgba(255,255,255,0.04)"
        strokeWidth="14"
        strokeLinecap="round"
      />
      {/* Value arc with glow */}
      <path
        d="M 10 100 A 90 90 0 0 1 190 100"
        fill="none"
        stroke="url(#gaugeGrad)"
        strokeWidth="14"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={strokeDashoffset}
        filter="url(#gaugeGlow)"
        style={{ transition: "stroke-dashoffset 1.5s cubic-bezier(0.4, 0, 0.2, 1)" }}
      />
      {/* Industry benchmark tick */}
      {bp && (
        <>
          <line
            x1={bp.x - 6 * Math.cos(Math.PI - benchmarkPct! * Math.PI)}
            y1={bp.y + 6 * Math.sin(Math.PI - benchmarkPct! * Math.PI)}
            x2={bp.x + 6 * Math.cos(Math.PI - benchmarkPct! * Math.PI)}
            y2={bp.y - 6 * Math.sin(Math.PI - benchmarkPct! * Math.PI)}
            stroke="#FBBF24"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <text
            x={bp.x}
            y={bp.y - 14}
            textAnchor="middle"
            fill="#FBBF24"
            fontSize="7"
            fontFamily="'Anybody', sans-serif"
            fontWeight="500"
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
      analyticsApi.industryBenchmark().then((d) => setBenchmark(d as IndustryBenchmark)).catch(() => { }),
    ])
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#07090F", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <AppNav />
        <div style={{ color: "rgba(129,140,248,0.6)", fontFamily: "'Anybody', sans-serif", fontSize: "14px" }}>
          Loading your moat data…
        </div>
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
    <>
      <style>{`
        @keyframes moatReveal {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes moatPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        @keyframes moatCostCount {
          from { opacity: 0; transform: scale(0.8); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes orbFloat {
          0%, 100% { transform: translate(0, 0); }
          33% { transform: translate(30px, -20px); }
          66% { transform: translate(-15px, 10px); }
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#07090F",
        fontFamily: "'Crimson Pro', Georgia, serif",
        position: "relative",
        overflow: "hidden",
      }}>
        <AppNav />

        {/* Ambient orbs */}
        <div style={{
          position: "fixed", top: "10%", left: "15%",
          width: "300px", height: "300px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%)",
          animation: "orbFloat 20s ease-in-out infinite",
          pointerEvents: "none",
        }} />
        <div style={{
          position: "fixed", bottom: "10%", right: "10%",
          width: "400px", height: "400px", borderRadius: "50%",
          background: "radial-gradient(circle, rgba(232,121,249,0.04) 0%, transparent 70%)",
          animation: "orbFloat 25s ease-in-out infinite reverse",
          pointerEvents: "none",
        }} />

        <div style={{ maxWidth: "700px", margin: "0 auto", padding: "48px 24px", position: "relative", zIndex: 1 }}>

          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: "48px", animation: "moatReveal 0.6s ease both" }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "38px", fontWeight: 800,
              background: "linear-gradient(135deg, #06B6D4, #818CF8, #E879F9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-1px",
              margin: "0 0 8px 0",
            }}>
              Your Moat
            </h1>
            <p style={{
              fontSize: "16px", fontStyle: "italic",
              color: "rgba(226,232,240,0.4)",
              fontWeight: 300,
            }}>
              The cost to replicate your institutional memory
            </p>
          </div>

          {/* Gauge */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: "24px",
            padding: "40px 32px 32px",
            textAlign: "center",
            marginBottom: "24px",
            animation: "moatReveal 0.6s 0.1s ease both",
          }}>
            <GaugeArc percentage={gaugePercent} benchmarkPct={benchmarkPct} />
            <div style={{ marginTop: "4px", animation: "moatCostCount 0.8s 0.5s ease both" }}>
              <div style={{
                fontFamily: "'Syne', sans-serif",
                fontSize: "52px", fontWeight: 800,
                background: "linear-gradient(135deg, #06B6D4, #818CF8)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                lineHeight: 1.1,
              }}>
                {formatCurrency(totalCost)}
              </div>
              <div style={{ fontSize: "14px", color: "rgba(226,232,240,0.3)", marginTop: "6px" }}>
                to rebuild elsewhere
              </div>
            </div>
            {benchmark && (
              <div style={{
                marginTop: "12px", fontSize: "13px",
                color: "#FBBF24", fontFamily: "'Anybody', sans-serif",
              }}>
                Industry avg ({benchmark.benchmark_label}): {formatCurrency(benchmark.avg_switching_cost_usd)}
              </div>
            )}
            <div style={{
              display: "inline-block",
              marginTop: "16px",
              padding: "6px 18px",
              borderRadius: "20px",
              background: "rgba(129,140,248,0.1)",
              border: "1px solid rgba(129,140,248,0.15)",
              fontFamily: "'Syne', sans-serif",
              fontSize: "12px", fontWeight: 600,
              color: "#A5B4FC",
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}>
              {milestone}
            </div>
          </div>

          {/* Stats row */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
            gap: "12px", marginBottom: "24px",
            animation: "moatReveal 0.6s 0.2s ease both",
          }}>
            {[
              { val: String(proposalsIndexed), label: "Proposals indexed" },
              { val: `${humanHours}h`, label: "Institutional knowledge" },
              { val: `${monthsActive}mo`, label: "Active months" },
            ].map(item => (
              <div key={item.label} style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(255,255,255,0.04)",
                borderRadius: "16px",
                padding: "20px 16px",
                textAlign: "center",
              }}>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "24px", fontWeight: 700,
                  color: "#E2E8F0",
                }}>
                  {item.val}
                </div>
                <div style={{
                  fontSize: "11px",
                  color: "rgba(148,163,184,0.4)",
                  marginTop: "4px",
                  fontFamily: "'Anybody', sans-serif",
                }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>

          {/* Milestone timeline */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.04)",
            borderRadius: "20px",
            padding: "28px",
            marginBottom: "24px",
            animation: "moatReveal 0.6s 0.3s ease both",
          }}>
            <h3 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "11px", fontWeight: 700,
              color: "rgba(148,163,184,0.4)",
              textTransform: "uppercase", letterSpacing: "2px",
              marginBottom: "20px",
            }}>
              Switching Cost Growth
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {MILESTONES.map((m, i) => {
                const isReached = monthsActive >= m.months;
                const isCurrent = i === currentMilestone;
                return (
                  <div key={m.label} style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <div style={{
                      width: "10px", height: "10px", borderRadius: "50%",
                      flexShrink: 0,
                      background: isReached
                        ? "linear-gradient(135deg, #06B6D4, #818CF8)"
                        : "rgba(255,255,255,0.06)",
                      boxShadow: isCurrent ? "0 0 12px rgba(6,182,212,0.4)" : "none",
                      transition: "all 0.3s",
                    }} />
                    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{
                        fontFamily: "'Syne', sans-serif",
                        fontSize: "14px", fontWeight: isCurrent ? 700 : 400,
                        color: isReached ? "#E2E8F0" : "rgba(148,163,184,0.3)",
                      }}>
                        {m.label}
                      </span>
                      <span style={{
                        fontFamily: "'Anybody', sans-serif",
                        fontSize: "13px", fontWeight: 500,
                        color: isReached ? "#818CF8" : "rgba(148,163,184,0.2)",
                      }}>
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
            <div style={{
              borderRadius: "20px",
              padding: "24px 28px",
              background: "linear-gradient(135deg, rgba(6,182,212,0.08), rgba(129,140,248,0.08))",
              border: "1px solid rgba(6,182,212,0.15)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              gap: "16px",
              animation: "moatReveal 0.6s 0.4s ease both",
            }}>
              <div>
                <div style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "14px", fontWeight: 600,
                  color: "#A5B4FC", marginBottom: "4px",
                }}>
                  Next milestone: {nextMilestone.label}
                </div>
                <div style={{
                  fontSize: "13px", fontStyle: "italic",
                  color: "rgba(226,232,240,0.4)",
                }}>
                  Upload {Math.max(0, nextMilestone.proposals - proposalsIndexed)} more proposals
                  to reach {formatCurrency(nextMilestone.cost)} switching cost
                </div>
              </div>
              <a
                href="/onboarding"
                style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "13px", fontWeight: 700,
                  color: "#0B0F1A",
                  background: "linear-gradient(135deg, #06B6D4, #818CF8)",
                  padding: "10px 20px",
                  borderRadius: "10px",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  transition: "transform 0.15s, box-shadow 0.15s",
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(6,182,212,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
              >
                Upload →
              </a>
            </div>
          )}

          <div style={{
            textAlign: "center", marginTop: "32px",
            fontFamily: "'Anybody', sans-serif",
            fontSize: "11px", color: "rgba(148,163,184,0.2)",
          }}>
            Switching cost = ({humanHours} hours × $39/hr labor) + ({monthsActive} months × $500 intelligence value)
          </div>
        </div>
      </div>
    </>
  );
}
