"use client";

/**
 * GTM Agent landing page — /gtm
 * Meeting intelligence: paste raw notes, get structured signals.
 */
import { useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";

type Signals = {
  budget_signals: string[];
  needs_identified: string[];
  objections: string[];
  deal_stage: string;
  next_actions: string[];
  proposal_recommended: boolean;
};

const STAGE_LABELS: Record<string, string> = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

const STAGE_COLORS: Record<string, string> = {
  discovery: "bg-blue-100 text-blue-700",
  proposal: "bg-amber-100 text-amber-700",
  negotiation: "bg-purple-100 text-purple-700",
  closed_won: "bg-green-100 text-green-700",
  closed_lost: "bg-red-100 text-red-500",
};

export default function GTMPage() {
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [signals, setSignals] = useState<Signals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    if (notes.trim().length < 20) {
      setError("Please enter at least 20 characters of meeting notes.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const result = await gtmApi.analyzeMeeting(clientName, notes);
      setSignals(result);
    } catch (err: any) {
      setError(err.message ?? "Analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <Link href="/dashboard" className="text-teal-600 font-bold text-xl">
          Draftly
        </Link>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/proposals">Proposals</Link>
          <Link href="/gtm" className="text-teal-600 font-medium">
            GTM Agent
          </Link>
          <Link href="/gtm/outreach">Outreach</Link>
          <Link href="/pipeline">Pipeline</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Meeting Intelligence</h1>
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
              Phase 2
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Paste raw meeting notes and Claude will extract structured deal signals — budget,
            needs, objections, and recommended next actions.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleAnalyze} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Client / prospect name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Acme Corp — Sarah Chen"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Meeting notes <span className="text-red-400">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={10}
              placeholder="Paste your raw meeting notes, call transcript, or summary here…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="bg-teal-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
          >
            {loading ? "Analysing…" : "Extract signals"}
          </button>
        </form>

        {/* Results */}
        {signals && (
          <div className="space-y-4">
            {/* Deal stage badge */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-700">Deal stage:</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  STAGE_COLORS[signals.deal_stage] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {STAGE_LABELS[signals.deal_stage] ?? signals.deal_stage}
              </span>
              {signals.proposal_recommended && (
                <span className="bg-teal-100 text-teal-700 text-xs px-2 py-0.5 rounded-full font-medium">
                  ✓ Proposal recommended
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Budget signals */}
              <SignalCard
                title="💰 Budget Signals"
                items={signals.budget_signals}
                color="green"
              />
              {/* Needs */}
              <SignalCard
                title="🎯 Needs Identified"
                items={signals.needs_identified}
                color="blue"
              />
              {/* Objections */}
              <SignalCard
                title="⚠ Objections"
                items={signals.objections}
                color="red"
              />
              {/* Next actions */}
              <SignalCard
                title="✅ Next Actions"
                items={signals.next_actions}
                color="teal"
              />
            </div>

            {signals.proposal_recommended && (
              <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium text-teal-800 text-sm">Ready to generate a proposal?</p>
                  <p className="text-teal-600 text-xs mt-0.5">
                    Claude identified a proposal opportunity from these notes.
                  </p>
                </div>
                <Link
                  href="/proposals/new"
                  className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
                >
                  Generate proposal →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SignalCard({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: "green" | "blue" | "red" | "teal";
}) {
  const colors = {
    green: "border-green-100",
    blue: "border-blue-100",
    red: "border-red-100",
    teal: "border-teal-100",
  };
  return (
    <div className={`bg-white border ${colors[color]} rounded-xl p-4`}>
      <h3 className="text-sm font-medium text-gray-700 mb-2">{title}</h3>
      {items.length === 0 ? (
        <p className="text-gray-300 text-xs">None identified</p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, i) => (
            <li key={i} className="text-gray-600 text-xs flex gap-2">
              <span className="text-gray-300 mt-0.5">•</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
