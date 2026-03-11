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

function MetricCard({ config, value, delay }: { config: typeof METRICS_CONFIG[number]; value: number; delay: number }) {
  const alarm = config.alarm;
  const isAlarming = alarm !== null && value >= alarm;
  return (
    <div style={{
      background: isAlarming ? "rgba(248,113,113,0.06)" : "rgba(255,255,255,0.03)",
      border: `1px solid ${isAlarming ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)"}`,
      borderRadius: "14px",
      padding: "20px",
      transition: "all 0.25s",
      animation: `dashFadeUp 0.4s ${delay}s ease both`,
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = isAlarming ? "rgba(248,113,113,0.25)" : "rgba(99,102,241,0.2)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = isAlarming ? "rgba(248,113,113,0.15)" : "rgba(255,255,255,0.06)";
      }}
    >
      <div style={{
        fontSize: "10px", fontWeight: 500,
        textTransform: "uppercase", letterSpacing: "0.8px",
        color: "rgba(148,163,184,0.6)",
        marginBottom: "8px",
        fontFamily: "'Outfit', sans-serif",
      }}>
        {config.label}
      </div>
      <div style={{
        fontSize: "26px", fontWeight: 700,
        fontFamily: "'JetBrains Mono', monospace",
        color: isAlarming ? "#F87171" : "#E2E8F0",
        lineHeight: 1.2,
      }}>
        {config.format(value)}
      </div>
      <div style={{
        fontSize: "11px", color: "rgba(148,163,184,0.4)",
        marginTop: "6px",
      }}>
        {config.target}
      </div>
      {isAlarming && (
        <div style={{
          fontSize: "11px", color: "#F87171",
          marginTop: "6px", fontWeight: 500,
          display: "flex", alignItems: "center", gap: "4px",
        }}>
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#F87171" }} />
          Above threshold
        </div>
      )}
    </div>
  );
}

// ── Win/Loss Modal ──────────────────────────────────────────────────

interface WinLossModalProps {
  type: "won" | "lost";
  proposalTitle: string;
  onSubmit: (reason: string, dealValue?: number) => void;
  onCancel: () => void;
  loading: boolean;
}

function WinLossModal({ type, proposalTitle, onSubmit, onCancel, loading }: WinLossModalProps) {
  const [reason, setReason] = useState("");
  const [dealValue, setDealValue] = useState("");

  const isWon = type === "won";
  const title = isWon ? "Mark as Won" : "Mark as Lost";
  const reasonLabel = isWon ? "What helped you win this deal?" : "Why was this deal lost?";
  const accent = isWon ? "#34D399" : "#F87171";
  const accentBg = isWon ? "rgba(52,211,153,0.06)" : "rgba(248,113,113,0.06)";

  return (
    <div
      onClick={onCancel}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.6)", backdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: "440px",
          background: "#13151F",
          borderRadius: "20px",
          border: "1px solid rgba(255,255,255,0.06)",
          animation: "dashFadeUp 0.2s ease both",
        }}
      >
        <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <h3 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "18px",
              fontWeight: 600, color: accent, margin: 0,
            }}>
              {title}
            </h3>
            <p style={{ fontSize: "13px", color: "rgba(148,163,184,0.5)", marginTop: "4px" }}>
              {proposalTitle || "Untitled Proposal"}
            </p>
          </div>

          <div>
            <label style={{
              display: "block", fontSize: "13px", fontWeight: 500,
              color: "rgba(226,232,240,0.7)", marginBottom: "6px",
              fontFamily: "'Outfit', sans-serif",
            }}>
              {reasonLabel}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={isWon ? "e.g. strong pricing, personal connection…" : "e.g. budget constraints, competitor…"}
              rows={3}
              style={{
                width: "100%", padding: "12px 14px",
                border: "1.5px solid rgba(99,102,241,0.15)",
                borderRadius: "10px",
                fontSize: "13px", color: "#E2E8F0",
                background: accentBg,
                outline: "none", resize: "none",
                fontFamily: "'DM Sans', sans-serif",
              }}
              autoFocus
              onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
              onBlur={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"}
            />
          </div>

          {isWon && (
            <div>
              <label style={{
                display: "block", fontSize: "13px", fontWeight: 500,
                color: "rgba(226,232,240,0.7)", marginBottom: "6px",
                fontFamily: "'Outfit', sans-serif",
              }}>
                Deal Value (optional)
              </label>
              <div style={{ position: "relative" }}>
                <span style={{
                  position: "absolute", left: "14px", top: "50%",
                  transform: "translateY(-50%)",
                  fontSize: "13px", color: "rgba(148,163,184,0.4)",
                }}>$</span>
                <input
                  type="number"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  placeholder="e.g. 8500"
                  style={{
                    width: "100%", padding: "10px 14px 10px 28px",
                    border: "1.5px solid rgba(99,102,241,0.15)",
                    borderRadius: "10px",
                    fontSize: "13px", color: "#E2E8F0",
                    background: "rgba(255,255,255,0.03)",
                    outline: "none",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
                  onBlur={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"}
                />
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: "10px", paddingTop: "4px" }}>
            <button
              onClick={onCancel}
              style={{
                flex: 1, padding: "12px",
                borderRadius: "10px",
                border: "1.5px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
                fontSize: "13px", fontWeight: 500,
                color: "rgba(226,232,240,0.5)",
                cursor: "pointer",
                fontFamily: "'Outfit', sans-serif",
                transition: "all 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
            >
              Cancel
            </button>
            <button
              onClick={() => onSubmit(reason, dealValue ? Number(dealValue) : undefined)}
              disabled={loading}
              style={{
                flex: 1, padding: "12px",
                borderRadius: "10px",
                border: "none",
                background: accent,
                fontSize: "13px", fontWeight: 600,
                color: "#0B0F1A",
                cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "'Outfit', sans-serif",
                opacity: loading ? 0.5 : 1,
                transition: "all 0.2s",
              }}
            >
              {loading ? "Saving…" : `Confirm ${isWon ? "Win" : "Loss"}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard ──────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [unitEcon, setUnitEcon] = useState<UnitEconomics | null>(null);
  const [winRate, setWinRate] = useState<WinRate | null>(null);
  const [phaseGate, setPhaseGate] = useState<PhaseGate | null>(null);
  const [cmStatus, setCmStatus] = useState<CMStatus | null>(null);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<{ type: "won" | "lost"; proposal: Proposal } | null>(null);
  const [modalLoading, setModalLoading] = useState(false);

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

  const handleModalSubmit = async (reason: string, dealValue?: number) => {
    if (!modal) return;
    setModalLoading(true);
    try {
      const data: Record<string, unknown> = {
        outcome: modal.type,
        ...(modal.type === "won" ? { win_reason: reason } : { lose_reason: reason }),
      };
      if (dealValue) data.value_usd = dealValue;
      await proposalsApi.update(modal.proposal.id, data);
      setProposals((prev) =>
        prev.map((x) => (x.id === modal.proposal.id ? { ...x, outcome: modal.type as "won" | "lost" } : x))
      );
      setModal(null);
    } catch (e) {
      console.error(e);
    } finally {
      setModalLoading(false);
    }
  };

  const isGtm = user?.tier === "gtm_agent";

  return (
    <>
      <style>{`
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0B0F1A", fontFamily: "'DM Sans', sans-serif" }}>
        <AppNav />

        {modal && (
          <WinLossModal
            type={modal.type}
            proposalTitle={modal.proposal.title || "Untitled"}
            onSubmit={handleModalSubmit}
            onCancel={() => setModal(null)}
            loading={modalLoading}
          />
        )}

        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }}>

          {/* ── Financial Metrics ── */}
          <div style={{ animation: "dashFadeUp 0.4s ease both" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "18px",
                fontWeight: 600, color: "#E2E8F0", margin: 0,
              }}>
                Financial Metrics
              </h2>
              <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)" }}>
                Scenario:{" "}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 500,
                  color: unitEcon?.on_track_for === "bull" ? "#FBBF24"
                    : unitEcon?.on_track_for === "base" ? "#818CF8" : "#F87171",
                }}>
                  {unitEcon?.on_track_for?.toUpperCase() ?? "—"} CASE
                </span>
              </div>
            </div>
            {loading ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                {[...Array(6)].map((_, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.04)",
                    borderRadius: "14px", height: "100px",
                  }} />
                ))}
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px" }}>
                {METRICS_CONFIG.map((config, i) => (
                  <MetricCard
                    key={config.key}
                    config={config}
                    value={unitEcon?.[config.key] ?? 0}
                    delay={0.05 * i}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ── Win Rate + Context-Mapper ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "24px" }}>

            {/* Win Rate */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "24px",
              animation: "dashFadeUp 0.4s 0.1s ease both",
            }}>
              <h3 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "15px",
                fontWeight: 600, color: "#E2E8F0",
                marginBottom: "16px",
              }}>
                Win Rate
              </h3>
              {winRate ? (
                <div>
                  <div style={{
                    fontSize: "42px", fontWeight: 700,
                    fontFamily: "'JetBrains Mono', monospace",
                    color: "#818CF8",
                    lineHeight: 1,
                  }}>
                    {((winRate.win_rate ?? 0) * 100).toFixed(0)}%
                  </div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px", marginTop: "20px",
                  }}>
                    {[
                      { val: winRate.total_proposals, label: "Total", color: "#E2E8F0" },
                      { val: winRate.won, label: "Won", color: "#34D399" },
                      { val: winRate.lost, label: "Lost", color: "#F87171" },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 600, color: item.color }}>
                          {item.val}
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.4)", marginTop: "2px" }}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{
                    fontSize: "13px", color: "rgba(148,163,184,0.5)",
                    marginTop: "16px",
                  }}>
                    Avg deal size: <strong style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "#A5B4FC",
                    }}>${winRate.avg_deal_size_usd?.toFixed(0)}</strong>
                  </div>
                </div>
              ) : (
                <div style={{ color: "rgba(148,163,184,0.3)" }}>Loading…</div>
              )}
            </div>

            {/* Context-Mapper */}
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "24px",
              animation: "dashFadeUp 0.4s 0.15s ease both",
            }}>
              <h3 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "15px",
                fontWeight: 600, color: "#E2E8F0",
                marginBottom: "16px",
              }}>
                Context-Mapper
              </h3>
              {cmStatus ? (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                    <span style={{
                      width: "7px", height: "7px", borderRadius: "50%",
                      background: cmStatus.context_mapper_active ? "#34D399" : "rgba(148,163,184,0.3)",
                      boxShadow: cmStatus.context_mapper_active ? "0 0 8px rgba(52,211,153,0.4)" : "none",
                    }} />
                    <span style={{ fontSize: "13px", color: "rgba(226,232,240,0.6)" }}>
                      {cmStatus.context_mapper_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                  <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "12px",
                  }}>
                    {[
                      { val: cmStatus.proposals_indexed, label: "Proposals" },
                      { val: cmStatus.pricing_rows, label: "Pricing rows" },
                      { val: cmStatus.brand_examples, label: "Brand examples" },
                    ].map(item => (
                      <div key={item.label} style={{ textAlign: "center" }}>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "18px", fontWeight: 600, color: "#E2E8F0" }}>
                          {item.val}
                        </div>
                        <div style={{ fontSize: "11px", color: "rgba(148,163,184,0.4)", marginTop: "2px" }}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>

                  {cmStatus.milestone_progress_pct !== undefined && cmStatus.next_milestone && (
                    <div style={{ marginTop: "18px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginBottom: "6px" }}>
                        <span style={{ color: "rgba(226,232,240,0.5)" }}>
                          Next: <strong style={{ color: "#A5B4FC" }}>{cmStatus.next_milestone}</strong>
                        </span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#818CF8" }}>
                          {Math.round(cmStatus.milestone_progress_pct)}%
                        </span>
                      </div>
                      <div style={{
                        height: "3px", borderRadius: "2px",
                        background: "rgba(255,255,255,0.06)",
                        overflow: "hidden",
                      }}>
                        <div style={{
                          height: "100%", borderRadius: "2px",
                          width: `${cmStatus.milestone_progress_pct}%`,
                          background: "linear-gradient(90deg, #6366F1, #818CF8)",
                          transition: "width 0.7s ease",
                        }} />
                      </div>
                      {cmStatus.proposals_to_next_milestone !== undefined && (
                        <p style={{ fontSize: "11px", color: "rgba(148,163,184,0.35)", marginTop: "6px" }}>
                          {cmStatus.proposals_to_next_milestone} proposals to next milestone
                          {cmStatus.estimated_days_to_milestone !== undefined && cmStatus.estimated_days_to_milestone > 0
                            ? ` · ~${cmStatus.estimated_days_to_milestone}d` : ""}
                        </p>
                      )}
                    </div>
                  )}

                  <Link
                    href="/moat-meter"
                    style={{
                      display: "inline-block",
                      fontSize: "12px", color: "#818CF8",
                      textDecoration: "none",
                      marginTop: "14px",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "#A5B4FC"}
                    onMouseLeave={e => e.currentTarget.style.color = "#818CF8"}
                  >
                    View Moat Meter →
                  </Link>
                </div>
              ) : (
                <div style={{ color: "rgba(148,163,184,0.3)" }}>Loading…</div>
              )}
            </div>
          </div>

          {/* ── GTM Quick Links ── */}
          {isGtm && (
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gap: "14px", marginTop: "24px",
              animation: "dashFadeUp 0.4s 0.2s ease both",
            }}>
              {[
                { href: "/gtm/meeting-signals", label: "Meeting Signals", desc: "Extract CRM signals from call notes" },
                { href: "/gtm/outreach", label: "Outreach Sequences", desc: "Generate personalized email drip" },
                { href: "/gtm", label: "Deal Pipeline", desc: "Drag-and-drop Kanban board" },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  style={{
                    display: "block",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "14px", padding: "18px",
                    textDecoration: "none",
                    transition: "all 0.25s",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-2px)";
                    e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                  }}
                >
                  <div style={{
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "14px", fontWeight: 600,
                    color: "#E2E8F0", marginBottom: "4px",
                  }}>{item.label}</div>
                  <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)" }}>{item.desc}</div>
                </Link>
              ))}
            </div>
          )}

          {/* ── Phase Gate ── */}
          {phaseGate && (
            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px", padding: "24px",
              marginTop: "24px",
              animation: "dashFadeUp 0.4s 0.25s ease both",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
                <h3 style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: "15px",
                  fontWeight: 600, color: "#E2E8F0", margin: 0,
                }}>
                  Phase 1 → 2 Gate
                </h3>
                <span style={{
                  fontSize: "11px", padding: "4px 12px",
                  borderRadius: "20px", fontWeight: 500,
                  background: phaseGate.all_passed ? "rgba(52,211,153,0.1)" : "rgba(255,255,255,0.04)",
                  color: phaseGate.all_passed ? "#34D399" : "rgba(148,163,184,0.5)",
                }}>
                  {phaseGate.all_passed ? "GTM Agent Unlocked" : "Phase 1 in progress"}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {([phaseGate.gate1, phaseGate.gate2, phaseGate.gate3] as Gate[]).map((gate) => (
                  <div key={gate.label} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{
                      width: "22px", height: "22px", borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: gate.passed ? "rgba(52,211,153,0.15)" : "rgba(255,255,255,0.04)",
                      color: gate.passed ? "#34D399" : "rgba(148,163,184,0.2)",
                      fontSize: "11px",
                    }}>
                      {gate.passed ? "✓" : "○"}
                    </div>
                    <span style={{ flex: 1, fontSize: "13px", color: "rgba(226,232,240,0.6)" }}>
                      {gate.label}
                    </span>
                    <span style={{
                      fontSize: "12px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "rgba(148,163,184,0.4)",
                    }}>
                      {gate.current} / {gate.target}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Recent Proposals ── */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "16px", padding: "24px",
            marginTop: "24px",
            animation: "dashFadeUp 0.4s 0.3s ease both",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
              <h3 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "15px",
                fontWeight: 600, color: "#E2E8F0", margin: 0,
              }}>
                Recent Proposals
              </h3>
              <Link
                href="/proposals"
                style={{ fontSize: "12px", color: "#818CF8", textDecoration: "none" }}
                onMouseEnter={e => e.currentTarget.style.color = "#A5B4FC"}
                onMouseLeave={e => e.currentTarget.style.color = "#818CF8"}
              >
                View all →
              </Link>
            </div>
            {proposals.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0" }}>
                <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.6 }}>✦</div>
                <h4 style={{
                  fontFamily: "'Outfit', sans-serif", fontSize: "17px",
                  fontWeight: 600, color: "#E2E8F0", marginBottom: "8px",
                }}>
                  Your first proposal is one click away
                </h4>
                <p style={{
                  fontSize: "13px", color: "rgba(148,163,184,0.5)",
                  maxWidth: "300px", margin: "0 auto 24px",
                  lineHeight: 1.6,
                }}>
                  Generate a tailored proposal in under 60 seconds. Each one teaches Context-Mapper how your firm sells.
                </p>
                <Link
                  href="/proposals/new"
                  style={{
                    display: "inline-block",
                    fontSize: "13px", fontWeight: 600,
                    fontFamily: "'Outfit', sans-serif",
                    padding: "10px 24px",
                    borderRadius: "10px",
                    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                    color: "#fff",
                    textDecoration: "none",
                    transition: "transform 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 28px rgba(99,102,241,0.3)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  ✦ Generate your first proposal
                </Link>
              </div>
            ) : (
              <div>
                {proposals.map((p, i) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "14px 0",
                      borderTop: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 500, color: "#E2E8F0" }}>
                        {p.title || "Untitled"}
                      </div>
                      <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.4)", marginTop: "2px" }}>
                        {p.client_name || "—"}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {p.value_usd && (
                        <span style={{
                          fontSize: "13px",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: "rgba(148,163,184,0.6)",
                        }}>
                          ${p.value_usd.toLocaleString()}
                        </span>
                      )}
                      {p.outcome === "pending" ? (
                        <>
                          <button
                            onClick={() => setModal({ type: "won", proposal: p })}
                            style={{
                              fontSize: "11px", padding: "4px 10px",
                              borderRadius: "16px", border: "none",
                              background: "rgba(52,211,153,0.1)",
                              color: "#34D399",
                              cursor: "pointer", fontWeight: 500,
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(52,211,153,0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(52,211,153,0.1)"}
                          >
                            Won ✓
                          </button>
                          <button
                            onClick={() => setModal({ type: "lost", proposal: p })}
                            style={{
                              fontSize: "11px", padding: "4px 10px",
                              borderRadius: "16px", border: "none",
                              background: "rgba(248,113,113,0.1)",
                              color: "#F87171",
                              cursor: "pointer", fontWeight: 500,
                              transition: "background 0.2s",
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(248,113,113,0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(248,113,113,0.1)"}
                          >
                            Lost ✗
                          </button>
                        </>
                      ) : (
                        <span style={{
                          fontSize: "11px", padding: "3px 10px",
                          borderRadius: "16px", fontWeight: 500,
                          background: p.outcome === "won" ? "rgba(52,211,153,0.1)" : p.outcome === "lost" ? "rgba(248,113,113,0.1)" : "rgba(255,255,255,0.04)",
                          color: p.outcome === "won" ? "#34D399" : p.outcome === "lost" ? "#F87171" : "rgba(148,163,184,0.4)",
                        }}>
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
    </>
  );
}
