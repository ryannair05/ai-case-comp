"use client";

/**
 * Proposal generation page — /proposals/new
 * Users paste an RFP brief and Draftly generates a full proposal
 * using the Context-Mapper knowledge graph + Claude Sonnet 4.6.
 */
import { useState } from "react";
import Link from "next/link";
import { proposalsApi } from "@/lib/api";

type Step = "form" | "generating" | "result";

export default function NewProposalPage() {
  const [step, setStep] = useState<Step>("form");
  const [rfpText, setRfpText] = useState("");
  const [clientName, setClientName] = useState("");
  const [valueUsd, setValueUsd] = useState("");
  const [result, setResult] = useState<{ proposal_id: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (rfpText.trim().length < 50) {
      setError("Please enter at least 50 characters describing the project brief.");
      return;
    }
    setError(null);
    setStep("generating");
    try {
      const data = await proposalsApi.generate(
        rfpText,
        clientName || undefined,
        valueUsd ? parseFloat(valueUsd) : undefined
      );
      setResult(data);
      setStep("result");
    } catch (err: any) {
      setError(err.message ?? "Generation failed. Please try again.");
      setStep("form");
    }
  }

  async function handleExportDocx() {
    if (!result) return;
    setExporting(true);
    try {
      await proposalsApi.exportDocx(result.proposal_id);
    } catch (err: any) {
      setError(err.message ?? "DOCX export failed.");
    } finally {
      setExporting(false);
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
        </div>
      </nav>

      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Generate Proposal</h1>
          <p className="text-gray-500 text-sm mt-1">
            Paste the RFP or project brief. Draftly will use your past proposals, pricing history,
            and brand voice to write a tailored proposal in seconds.
          </p>
        </div>

        {step === "form" && (
          <form onSubmit={handleGenerate} className="space-y-5">
            {/* Client name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Client name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* Deal value */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Estimated deal value{" "}
                <span className="text-gray-400 font-normal">(USD, optional)</span>
              </label>
              <input
                type="number"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                placeholder="e.g. 25000"
                min={0}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>

            {/* RFP text */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                RFP / Project Brief <span className="text-red-400">*</span>
              </label>
              <textarea
                value={rfpText}
                onChange={(e) => setRfpText(e.target.value)}
                rows={12}
                placeholder="Paste the full RFP, client brief, or project description here. The more detail you include, the more accurate the proposal will be."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
                required
              />
              <div className="text-xs text-gray-400 mt-1 text-right">
                {rfpText.length} characters
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                className="bg-teal-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                Generate Proposal
              </button>
              <Link
                href="/proposals"
                className="px-6 py-2.5 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </Link>
            </div>
          </form>
        )}

        {step === "generating" && (
          <div className="bg-white border border-gray-100 rounded-xl p-12 text-center">
            <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-700 font-medium">Generating your proposal…</p>
            <p className="text-gray-400 text-sm mt-1">
              Claude Sonnet 4.6 is pulling from your Context-Mapper data.
            </p>
          </div>
        )}

        {step === "result" && result && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={handleExportDocx}
                disabled={exporting}
                className="bg-teal-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                {exporting ? "Exporting…" : "⬇ Download as Word (.docx)"}
              </button>
              <Link
                href="/proposals"
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                View all proposals
              </Link>
              <button
                onClick={() => {
                  setStep("form");
                  setResult(null);
                  setRfpText("");
                  setClientName("");
                  setValueUsd("");
                }}
                className="px-5 py-2 rounded-lg text-sm font-medium text-gray-500 hover:bg-gray-50 transition-colors"
              >
                Generate another
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            {/* Proposal content */}
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Generated Proposal</h2>
              <div className="prose prose-sm max-w-none">
                {result.content.split("\n\n").map((para, i) => {
                  const trimmed = para.trim();
                  if (!trimmed) return null;
                  if (trimmed.startsWith("#")) {
                    return (
                      <h3 key={i} className="font-bold text-gray-900 mt-4 mb-1">
                        {trimmed.replace(/^#+\s*/, "")}
                      </h3>
                    );
                  }
                  return (
                    <p key={i} className="text-gray-700 text-sm leading-relaxed mb-3">
                      {trimmed}
                    </p>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
