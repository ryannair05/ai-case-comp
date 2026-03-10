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
      className="bg-white border rounded-xl p-4 cursor-grab active:cursor-grabbing shadow-sm card-hover select-none"
      style={{ borderColor: "var(--vellum-border)" }}
    >
      <div className="font-semibold text-sm mb-1" style={{ color: "var(--ink-primary)" }}>
        {deal.client_name}
      </div>
      {deal.needs && (
        <div className="text-xs mb-1 line-clamp-2" style={{ color: "var(--ink-secondary)" }}>
          {deal.needs}
        </div>
      )}
      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {deal.budget && (
          <span className="text-xs font-mono bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full">
            {deal.budget}
          </span>
        )}
        {deal.timeline && (
          <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
            {deal.timeline}
          </span>
        )}
      </div>
      <div className="mt-3">
        <Link
          href={`/proposals/new?clientName=${encodeURIComponent(deal.client_name)}&context=${encodeURIComponent(deal.needs ?? "")}`}
          className="text-xs font-medium hover:underline"
          style={{ color: "var(--indigo)" }}
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
      className="flex flex-col gap-3 min-h-[200px] rounded-xl p-3 transition-colors"
      style={{
        background: isDragOver ? "rgba(99,102,241,0.04)" : "rgba(0,0,0,0.02)",
        border: `1px solid ${isDragOver ? "var(--indigo)" : "var(--vellum-border)"}`,
        minWidth: "200px",
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
      <div className="flex items-center gap-2 mb-1 px-1">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ background: stage.color }}
        />
        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--ink-secondary)" }}>
          {stage.label}
        </span>
        <span
          className="ml-auto text-xs font-mono rounded-full px-1.5 py-0.5"
          style={{ background: "rgba(0,0,0,0.06)", color: "var(--ink-muted)" }}
        >
          {deals.length}
        </span>
      </div>

      {deals.map((deal) => (
        <DealCard key={deal.id} deal={deal} onDragStart={onDragStart} />
      ))}

      {deals.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-xs" style={{ color: "var(--ink-muted)" }}>
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
    <div className="min-h-screen" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6 fade-up">
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
              Deal Pipeline
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
              Drag cards between stages to update deal status.
            </p>
          </div>
          <Link
            href="/gtm/meeting-signals"
            className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-colors"
            style={{ background: "var(--indigo)" }}
          >
            + New Signal
          </Link>
        </div>

        {loading ? (
          <div className="flex gap-4">
            {STAGES.map((s) => (
              <div key={s.id} className="flex-1 h-64 bg-white rounded-xl border animate-pulse" style={{ borderColor: "var(--vellum-border)" }} />
            ))}
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
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
          <div className="mt-8 text-center py-16 border-2 border-dashed rounded-2xl" style={{ borderColor: "var(--vellum-border)" }}>
            <div className="text-4xl mb-3">📡</div>
            <div className="font-semibold mb-1" style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--ink-primary)" }}>
              No deals yet
            </div>
            <p className="text-sm mb-4" style={{ color: "var(--ink-secondary)" }}>
              Extract meeting signals to populate your pipeline.
            </p>
            <Link
              href="/gtm/meeting-signals"
              className="text-sm font-medium px-4 py-2 rounded-lg text-white"
              style={{ background: "var(--indigo)" }}
            >
              Extract Meeting Signals →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
