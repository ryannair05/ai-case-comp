"use client";

/**
 * Pipeline & Deal Velocity dashboard — /pipeline
 * Shows all deals grouped by stage with velocity metrics.
 * Powered by the GTM /pipeline API endpoint.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";

const STAGE_ORDER = ["discovery", "proposal", "negotiation", "closed_won", "closed_lost"];

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  discovery: { label: "Discovery", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  proposal: { label: "Proposal Sent", color: "text-amber-700", bg: "bg-amber-50 border-amber-200" },
  negotiation: { label: "Negotiation", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  closed_won: { label: "Closed Won", color: "text-green-700", bg: "bg-green-50 border-green-200" },
  closed_lost: { label: "Closed Lost", color: "text-red-600", bg: "bg-red-50 border-red-200" },
};

type Deal = {
  proposal_id: string;
  client_name: string | null;
  value_usd: number | null;
  outcome: string | null;
  deal_stage: string;
  days_open: number;
  created_at: string | null;
};

type PipelineData = {
  pipeline: Deal[];
  stage_totals: Record<string, { count: number; value: number }>;
  open_pipeline_value_usd: number;
  avg_days_to_close: number | null;
  total_deals: number;
};

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gtmApi
      .pipeline()
      .then(setData)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageShell>
        <div className="p-12 text-center text-gray-400 animate-pulse">Loading pipeline…</div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell>
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      </PageShell>
    );
  }

  const pipeline = data?.pipeline ?? [];
  const stageTotals = data?.stage_totals ?? {};

  return (
    <PageShell>
      {/* Summary metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Open pipeline"
          value={`$${(data?.open_pipeline_value_usd ?? 0).toLocaleString()}`}
        />
        <MetricCard
          label="Total deals"
          value={String(data?.total_deals ?? 0)}
        />
        <MetricCard
          label="Avg days to close"
          value={data?.avg_days_to_close != null ? `${data.avg_days_to_close}d` : "—"}
        />
      </div>

      {/* Stage kanban */}
      <div className="grid grid-cols-5 gap-3">
        {STAGE_ORDER.map((stage) => {
          const cfg = STAGE_CONFIG[stage];
          const deals = pipeline.filter((d) => d.deal_stage === stage);
          const totals = stageTotals[stage] ?? { count: 0, value: 0 };
          return (
            <div key={stage} className="space-y-2">
              {/* Column header */}
              <div className={`border rounded-lg px-3 py-2 ${cfg.bg}`}>
                <div className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  {totals.count} deal{totals.count !== 1 ? "s" : ""}
                  {totals.value > 0 && ` · $${totals.value.toLocaleString()}`}
                </div>
              </div>

              {/* Deal cards */}
              {deals.length === 0 ? (
                <div className="text-center text-gray-300 text-xs py-4">Empty</div>
              ) : (
                deals.map((deal) => (
                  <div
                    key={deal.proposal_id}
                    className="bg-white border border-gray-100 rounded-lg p-3 space-y-1 hover:border-teal-200 transition-colors"
                  >
                    <div className="text-xs font-medium text-gray-900 truncate">
                      {deal.client_name || "Unknown client"}
                    </div>
                    {deal.value_usd != null && (
                      <div className="text-xs text-gray-500">
                        ${deal.value_usd.toLocaleString()}
                      </div>
                    )}
                    <div className="text-xs text-gray-400">{deal.days_open}d open</div>
                  </div>
                ))
              )}
            </div>
          );
        })}
      </div>

      {/* Recent deals table */}
      <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-bold text-gray-900">All Deals</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Stage</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Value</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500">Days open</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {pipeline.map((deal) => {
              const cfg = STAGE_CONFIG[deal.deal_stage] ?? { label: deal.deal_stage, color: "text-gray-600", bg: "" };
              return (
                <tr key={deal.proposal_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 text-gray-700 font-medium">
                    {deal.client_name || <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 text-right">
                    {deal.value_usd != null ? `$${deal.value_usd.toLocaleString()}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-right">{deal.days_open}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {deal.created_at ? new Date(deal.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {pipeline.length === 0 && (
          <div className="px-5 py-8 text-center text-gray-400 text-sm">
            No deals yet.{" "}
            <Link href="/proposals/new" className="text-teal-600 hover:underline">
              Generate a proposal →
            </Link>
          </div>
        )}
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-teal-600 font-bold text-xl">
          Draftly
        </Link>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/proposals">Proposals</Link>
          <Link href="/gtm">GTM Agent</Link>
          <Link href="/gtm/outreach">Outreach</Link>
          <Link href="/pipeline" className="text-teal-600 font-medium">
            Pipeline
          </Link>
        </div>
      </nav>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Deal Pipeline</h1>
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
              Phase 2
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Track all proposals through your sales pipeline with velocity metrics.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
    </div>
  );
}
