"use client";

/**
 * /proposals/new — Proposal generation UI (previously missing P0 feature).
 *
 * Calls POST /proposals/generate (RAG + Claude Sonnet 4.6).
 * Shows cold-start notice when < 15 proposals are indexed.
 * Lets the user download the result as a .docx file.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { proposalsApi } from "@/lib/api";
import { useAuth, hasProfessionalAccess } from "@/lib/auth";

const EXAMPLE_RFPS = [
  "We need a 3-month social media strategy for our B2B SaaS company launching in Q3. Budget TBD based on proposal.",
  "Looking for a brand refresh including new logo, website copy, and one-pager. We're a 12-person accounting firm.",
  "We need help with our annual tax planning strategy and implementing a proactive approach for next fiscal year.",
];

export default function NewProposalPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [rfpText, setRfpText]         = useState("");
  const [clientName, setClientName]   = useState("");
  const [valueUsd, setValueUsd]       = useState("");
  const [generating, setGenerating]   = useState(false);
  const [result, setResult]           = useState<{ proposal_id: string; content: string } | null>(null);
  const [error, setError]             = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isProfessional = hasProfessionalAccess(user?.tier);

  async function handleGenerate() {
    if (rfpText.trim().length < 50) {
      setError("Please enter at least 50 characters describing the RFP or brief.");
      return;
    }
    setError(null);
    setGenerating(true);
    setResult(null);
    try {
      const res = await proposalsApi.generate(
        rfpText,
        clientName || undefined,
        valueUsd ? parseFloat(valueUsd) : undefined
      );
      setResult(res);
    } catch (err: any) {
      setError(err.message ?? "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      await proposalsApi.exportDocx(result.proposal_id, clientName || "proposal");
    } catch (err: any) {
      setError("Download failed: " + err.message);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-teal-600 font-bold text-xl">Draftly</span>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/proposals/new" className="text-teal-600 font-medium">New Proposal</Link>
          <Link href="/moat-meter">Moat Meter</Link>
          <Link href="/onboarding">Upload</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Generate a Proposal</h1>
          <p className="text-gray-500 text-sm mt-1">
            Powered by Claude Sonnet + your Context-Mapper institutional memory.
          </p>
        </div>

        {!isProfessional && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <span className="text-amber-500 text-xl">⚠</span>
            <div>
              <div className="font-medium text-amber-800 text-sm">Professional tier required</div>
              <div className="text-amber-700 text-xs mt-0.5">
                Context-Mapper AI generation requires the Professional plan ($249/mo).{" "}
                <a href="/billing" className="underline">Upgrade →</a>
              </div>
            </div>
          </div>
        )}

        {/* Input panel */}
        <div className="bg-white border border-gray-100 rounded-2xl p-6 space-y-5 shadow-sm">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Client name <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Brightfield Technologies"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Deal value <span className="text-gray-400 font-normal">(USD, optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
              <input
                type="number"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                placeholder="12500"
                className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RFP / Brief <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rfpText}
              onChange={(e) => setRfpText(e.target.value)}
              rows={8}
              placeholder="Paste the client's RFP, project brief, or describe what they need…"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-gray-400">{rfpText.length} chars (min 50)</span>
              <div className="flex gap-2">
                {EXAMPLE_RFPS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setRfpText(ex)}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    Example {i + 1}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating || !isProfessional}
            className="w-full bg-teal-600 hover:bg-teal-700 text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating with Context-Mapper…
              </>
            ) : (
              "✦ Generate Proposal"
            )}
          </button>
        </div>

        {/* Output panel */}
        {result && (
          <div className="bg-white border border-teal-100 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">
                Generated Proposal {clientName ? `for ${clientName}` : ""}
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                  {downloading ? "Downloading…" : "⬇ Download .docx"}
                </button>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 border border-gray-200 text-gray-600 text-sm px-4 py-2 rounded-lg hover:bg-gray-50"
                >
                  View in Dashboard →
                </Link>
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 max-h-[500px] overflow-y-auto">
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                {result.content}
              </pre>
            </div>

            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="w-2 h-2 bg-teal-400 rounded-full" />
              Generated with Claude Sonnet 4.6 + your Context-Mapper · Proposal ID: {result.proposal_id.slice(0, 8)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
