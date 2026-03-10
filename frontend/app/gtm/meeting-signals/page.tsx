"use client";

import { useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";
import { MeetingSignalResult } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

export default function MeetingSignalsPage() {
  const [notes, setNotes] = useState("");
  const [clientName, setClientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MeetingSignalResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!notes || !clientName) {
      setError("Please provide both notes and client name.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await gtmApi.extractMeetingSignals(notes, clientName);
      setResult(res as MeetingSignalResult);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Extraction failed");
    } finally {
      setLoading(false);
    }
  };

  const proposalHref = result
    ? `/proposals/new?clientName=${encodeURIComponent(result.client_name)}&context=${encodeURIComponent(result.needs ?? "")}`
    : "#";

  return (
    <div className="min-h-screen" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <div className="max-w-4xl mx-auto p-6 mt-6">
        <div className="mb-8 fade-up">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
            Meeting Signal Extractor
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
            Paste your raw call notes. AI will extract structured CRM signals and update your deal automatically.
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4 fade-up-1" style={{ borderColor: "var(--vellum-border)" }}>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>
              Prospect / Client Name
            </label>
            <input
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="E.g., Acme Corp"
              className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ borderColor: "var(--vellum-border)" }}
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>
              Raw Meeting Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="- CEO wants to move fast... needs scale..."
              className="w-full border rounded-lg p-3 text-sm h-48 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              style={{ borderColor: "var(--vellum-border)" }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            onClick={handleExtract}
            className="w-full text-white rounded-lg py-2 font-medium transition-colors disabled:opacity-50"
            style={{ background: "var(--indigo)" }}
          >
            {loading ? "Extracting…" : "Extract Signals"}
          </button>
        </div>

        {result && (
          <div className="mt-8 space-y-4 fade-up">
            {/* Extracted payload */}
            <div className="bg-gray-950 rounded-xl p-6 text-green-400 font-mono text-sm overflow-auto shadow-lg">
              <h3 className="text-white text-lg font-bold mb-4" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                Extracted CRM Payload
              </h3>
              <pre>{JSON.stringify(result, null, 2)}</pre>
            </div>

            {/* CRM push status */}
            <div
              className={`rounded-xl p-4 flex items-center gap-3 border text-sm ${
                result.crm_pushed
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-amber-50 border-amber-200 text-amber-800"
              }`}
            >
              <span className="text-xl">{result.crm_pushed ? "✓" : "⚠"}</span>
              <span>
                {result.crm_pushed
                  ? "Deal automatically pushed to your CRM."
                  : result.crm_error
                  ? `CRM push skipped: ${result.crm_error}`
                  : "No CRM connected — connect one in Settings."}
              </span>
            </div>

            {/* Generate Proposal CTA */}
            <div className="bg-white border rounded-xl p-5 flex items-center justify-between" style={{ borderColor: "var(--vellum-border)" }}>
              <div>
                <div className="font-semibold text-sm" style={{ color: "var(--ink-primary)" }}>
                  Ready to write the proposal?
                </div>
                <div className="text-xs mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                  We&apos;ve pre-filled the brief with extracted needs for {result.client_name}.
                </div>
              </div>
              <Link
                href={proposalHref}
                className="text-sm font-medium px-4 py-2 rounded-lg text-white whitespace-nowrap ml-4"
                style={{ background: "var(--indigo)" }}
              >
                Generate Proposal →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
