"use client";

/**
 * /gtm — Deal Pipeline Kanban Board.
 * Displays DealSignals across 5 stages with HTML5 drag-and-drop.
 * Calls gtmApi.updateDealStage() on drop with optimistic updates.
 */
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";
import { DealSignal, DealStage } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

const STAGES: { id: DealStage; label: string; color: string }[] = [
  { id: "discovery", label: "Discovery", color: "#6366F1" },
  { id: "proposal", label: "Proposal Sent", color: "#8B5CF6" },
  { id: "negotiation", label: "Negotiation", color: "#F59E0B" },
  { id: "closed_won", label: "Closed Won", color: "#10B981" },
  { id: "closed_lost", label: "Closed Lost", color: "#EF4444" },
];

function DealCard({
  deal,
  onDragStart,
}: {
  deal: DealSignal;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, deal.id)}
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "14px",
        padding: "16px",
        cursor: "grab",
        transition: "all 0.25s",
        userSelect: "none",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-2px)";
        e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)";
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <div style={{
        fontSize: "14px", fontWeight: 600,
        color: "#E2E8F0", marginBottom: "4px",
        fontFamily: "'Outfit', sans-serif",
      }}>
        {deal.client_name}
      </div>
      {deal.needs && (
        <div style={{
          fontSize: "12px", color: "rgba(148,163,184,0.5)",
          marginBottom: "8px", lineClamp: 2, display: "-webkit-box", WebkitBoxOrient: "vertical", overflow: "hidden"
        }}>
          {deal.needs}
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
        {deal.budget && (
          <span style={{
            fontSize: "11px", fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(99,102,241,0.1)", color: "#818CF8",
            padding: "2px 8px", borderRadius: "10px", fontWeight: 500,
          }}>
            {deal.budget}
          </span>
        )}
        {deal.timeline && (
          <span style={{ fontSize: "11px", color: "rgba(148,163,184,0.4)" }}>
            {deal.timeline}
          </span>
        )}
      </div>
      <div style={{ marginTop: "12px" }}>
        <Link
          href={`/proposals/new?clientName=${encodeURIComponent(deal.client_name)}&context=${encodeURIComponent(deal.needs ?? "")}`}
          style={{
            fontSize: "12px", fontWeight: 600,
            color: "#818CF8", textDecoration: "none",
            fontFamily: "'Outfit', sans-serif",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#A5B4FC"}
          onMouseLeave={e => e.currentTarget.style.color = "#818CF8"}
        >
          Generate Proposal →
        </Link>
      </div>
    </div>
  );
}

function KanbanColumn({
  stage,
  deals,
  onDragOver,
  onDrop,
  onDragStart,
}: {
  stage: typeof STAGES[0];
  deals: DealSignal[];
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, targetStage: DealStage) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
}) {
  const [isDragOver, setIsDragOver] = useState(false);

  return (
    <div
      style={{
        display: "flex", flexDirection: "column", gap: "12px",
        minHeight: "400px", borderRadius: "16px", padding: "16px",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        background: isDragOver ? "rgba(99,102,241,0.05)" : "rgba(255,255,255,0.02)",
        border: `1px solid ${isDragOver ? "rgba(99,102,241,0.3)" : "rgba(255,255,255,0.05)"}`,
        minWidth: "240px",
        flex: 1,
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
        onDragOver(e);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        setIsDragOver(false);
        onDrop(e, stage.id);
      }}
    >
      {/* Column header */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", padding: "0 4px" }}>
        <span
          style={{ width: "6px", height: "6px", borderRadius: "50%", background: stage.color, boxShadow: `0 0 8px ${stage.color}` }}
        />
        <span style={{
          fontSize: "11px", fontWeight: 600,
          textTransform: "uppercase", letterSpacing: "0.8px",
          color: "rgba(148,163,184,0.6)",
          fontFamily: "'Outfit', sans-serif",
        }}>
          {stage.label}
        </span>
        <span
          style={{
            marginLeft: "auto", fontSize: "11px",
            fontFamily: "'JetBrains Mono', monospace",
            background: "rgba(255,255,255,0.04)",
            color: "rgba(148,163,184,0.4)",
            padding: "2px 6px", borderRadius: "10px",
          }}
        >
          {deals.length}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />
        ))}
      </div>

      {deals.length === 0 && (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: "11px", color: "rgba(148,163,184,0.25)",
          border: "1px dashed rgba(255,255,255,0.03)",
          borderRadius: "12px", marginTop: "8px",
        }}>
          Drop deals here
        </div>
      )}
    </div>
  );
}

export default function GTMPipelinePage() {
  const [deals, setDeals] = useState<DealSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const dragId = useRef<string | null>(null);

  useEffect(() => {
    gtmApi
      .listDealSignals()
      .then(setDeals)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  function handleDragStart(e: React.DragEvent, id: string) {
    dragId.current = id;
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }

  async function handleDrop(e: React.DragEvent, targetStage: DealStage) {
    e.preventDefault();
    const id = dragId.current;
    if (!id) return;
    const deal = deals.find((d) => d.id === id);
    if (!deal || deal.stage === targetStage) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) => (d.id === id ? { ...d, stage: targetStage } : d))
    );

    try {
      await gtmApi.updateDealStage(id, targetStage);
    } catch (err) {
      console.error("Stage update failed:", err);
      // Revert
      setDeals((prev) =>
        prev.map((d) => (d.id === id ? { ...d, stage: deal.stage } : d))
      );
    }

    dragId.current = null;
  }

  const dealsByStage = (stage: DealStage) =>
    deals.filter((d) => d.stage === stage);

  return (
    <>
      <style>{`
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: dashFadeUp 0.4s ease both; }
        .fade-up-1 { animation: dashFadeUp 0.4s 0.1s ease both; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0B0F1A", fontFamily: "'DM Sans', sans-serif" }}>
        <AppNav />

        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "32px" }} className="fade-up">
            <div>
              <h1 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "28px",
                fontWeight: 600, color: "#E2E8F0", margin: 0,
              }}>
                Deal Pipeline
              </h1>
              <p style={{ fontSize: "14px", color: "rgba(148,163,184,0.5)", marginTop: "4px" }}>
                Drag cards between stages to update deal status.
              </p>
            </div>
            <Link
              href="/gtm/meeting-signals"
              style={{
                fontSize: "14px", fontWeight: 600,
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
              ✦ New Signal
            </Link>
          </div>

          {loading ? (
            <div style={{ display: "flex", gap: "16px", overflowX: "auto" }} className="no-scrollbar">
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  flex: 1, minHeight: "400px", minWidth: "240px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid rgba(255,255,255,0.05)",
                  borderRadius: "16px",
                  animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
                }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "flex", gap: "16px", overflowX: "auto", paddingBottom: "24px" }} className="no-scrollbar fade-up-1">
              {STAGES.map((stage) => (
                <KanbanColumn
                  key={stage.id}
                  stage={stage}
                  deals={dealsByStage(stage.id)}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragStart={handleDragStart}
                />
              ))}
            </div>
          )}

          {!loading && deals.length === 0 && (
            <div style={{
              marginTop: "32px", textAlign: "center", padding: "64px 0",
              border: "1.5px dashed rgba(255,255,255,0.06)", borderRadius: "24px",
              animation: "dashFadeUp 0.4s 0.2s ease both",
            }}>
              <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.6 }}>📡</div>
              <h2 style={{
                fontFamily: "'Outfit', sans-serif", fontSize: "20px",
                fontWeight: 600, color: "#E2E8F0", marginBottom: "8px",
              }}>
                No deals yet
              </h2>
              <p style={{
                fontSize: "14px", color: "rgba(148,163,184,0.5)",
                maxWidth: "340px", margin: "0 auto 24px",
                lineHeight: 1.6,
              }}>
                Extract meeting signals to populate your pipeline.
              </p>
              <Link
                href="/gtm/meeting-signals"
                style={{
                  display: "inline-block",
                  fontSize: "14px", fontWeight: 600,
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
                ✦ Extract Meeting Signals
              </Link>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
