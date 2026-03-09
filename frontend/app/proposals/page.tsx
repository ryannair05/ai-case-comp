"use client";

/**
 * Proposals list page — /proposals
 * Shows all proposals with status, deal value, and quick actions.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { proposalsApi } from "@/lib/api";

export default function ProposalsPage() {
  const [proposals, setProposals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<string | null>(null);

  useEffect(() => {
    proposalsApi
      .list()
      .then(setProposals)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleExportDocx(id: string) {
    setExporting(id);
    try {
      await proposalsApi.exportDocx(id);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setExporting(null);
    }
  }

  async function handleMarkOutcome(id: string, outcome: "won" | "lost") {
    try {
      await proposalsApi.update(id, { outcome });
      setProposals((prev) => prev.map((p) => (p.id === id ? { ...p, outcome } : p)));
    } catch (e: any) {
      setError(e.message);
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
          <Link href="/proposals" className="text-teal-600 font-medium">
            Proposals
          </Link>
          <Link href="/moat-meter">Moat Meter</Link>
          <Link href="/gtm">GTM Agent</Link>
          <Link href="/pipeline">Pipeline</Link>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Proposals</h1>
            <p className="text-gray-500 text-sm mt-0.5">
              All proposals — indexed into your Context-Mapper knowledge graph.
            </p>
          </div>
          <Link
            href="/proposals/new"
            className="bg-teal-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            + Generate proposal
          </Link>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 animate-pulse">Loading proposals…</div>
          ) : proposals.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400 text-sm mb-3">No proposals yet.</p>
              <Link
                href="/proposals/new"
                className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                Generate your first proposal →
              </Link>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Title</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">Date</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {proposals.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 font-medium">
                      {p.client_name || <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {p.title || <span className="text-gray-300">Untitled</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-700 text-right">
                      {p.value_usd ? `$${p.value_usd.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          p.outcome === "won"
                            ? "bg-green-100 text-green-700"
                            : p.outcome === "lost"
                            ? "bg-red-100 text-red-500"
                            : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {p.outcome ?? "pending"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        {p.outcome === "pending" && (
                          <>
                            <button
                              onClick={() => handleMarkOutcome(p.id, "won")}
                              className="text-xs text-green-600 hover:underline"
                            >
                              Mark won
                            </button>
                            <button
                              onClick={() => handleMarkOutcome(p.id, "lost")}
                              className="text-xs text-red-400 hover:underline"
                            >
                              Mark lost
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleExportDocx(p.id)}
                          disabled={exporting === p.id}
                          className="text-xs text-teal-600 hover:underline disabled:opacity-50"
                        >
                          {exporting === p.id ? "…" : "⬇ .docx"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
