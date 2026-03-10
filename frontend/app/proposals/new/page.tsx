"use client";

/**
 * /proposals/new — Proposal generation UI.
 *
 * Improvements:
 * - Cold-start gap indicator: shows how many proposals are indexed and a
 *   progress bar toward the 15-proposal threshold for full Context-Mapper.
 * - Star rating widget: after generation, lets user rate proposal quality
 *   (1-5 stars) which is POSTed back via proposalsApi.update().
 * - Section-by-section editing: parses generated markdown by H2 (##) headers
 *   into editable sections so users can tweak individual sections.
 */
import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { proposalsApi, contextMapperApi } from "@/lib/api";
import { useAuth, hasProfessionalAccess } from "@/lib/auth";
import AppNav from "@/app/components/AppNav";

const EXAMPLE_RFPS = [
  "We need a 3-month social media strategy for our B2B SaaS company launching in Q3. Budget TBD based on proposal.",
  "Looking for a brand refresh including new logo, website copy, and one-pager. We&apos;re a 12-person accounting firm.",
  "We need help with our annual tax planning strategy and implementing a proactive approach for next fiscal year.",
];

interface ProposalSection {
  heading: string;
  body: string;
}

/** Split markdown content into sections by ## headers */
function splitIntoSections(content: string): ProposalSection[] {
  const lines = content.split("\n");
  const sections: ProposalSection[] = [];
  let currentHeading = "";
  let currentLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (currentLines.length > 0 || currentHeading) {
        sections.push({ heading: currentHeading, body: currentLines.join("\n").trim() });
      }
      currentHeading = line.replace(/^## /, "");
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  if (currentLines.length > 0 || currentHeading) {
    sections.push({ heading: currentHeading, body: currentLines.join("\n").trim() });
  }
  return sections;
}

/** Star rating component */
function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          className="text-2xl transition-transform hover:scale-110"
          style={{ color: star <= (hover || value) ? "#f59e0b" : "#d1d5db" }}
        >
          ★
        </button>
      ))}
    </div>
  );
}

function NewProposalInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();

  const [rfpText, setRfpText] = useState(searchParams.get("context") ?? "");
  const [clientName, setClientName] = useState(searchParams.get("clientName") ?? "");
  const [valueUsd, setValueUsd] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ proposal_id: string; content: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Cold-start state
  const [proposalsIndexed, setProposalsIndexed] = useState<number | null>(null);
  const COLD_START_THRESHOLD = 15;

  // Star rating state
  const [starRating, setStarRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  // Section editing state
  const [sectionMode, setSectionMode] = useState(false);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [editingSection, setEditingSection] = useState<number | null>(null);

  const isProfessional = hasProfessionalAccess(user?.tier);

  // Fetch Context-Mapper status for cold-start indicator
  useEffect(() => {
    if (!isProfessional) return;
    contextMapperApi.status().then((status) => {
      setProposalsIndexed(status?.proposals_indexed ?? 0);
    }).catch(() => {});
  }, [isProfessional]);

  async function handleGenerate() {
    if (rfpText.trim().length < 50) {
      setError("Please enter at least 50 characters describing the RFP or brief.");
      return;
    }
    setError(null);
    setGenerating(true);
    setResult(null);
    setStarRating(0);
    setRatingSubmitted(false);
    setSectionMode(false);
    try {
      const res = await proposalsApi.generate(
        rfpText,
        clientName || undefined,
        valueUsd ? parseFloat(valueUsd) : undefined
      );
      setResult(res);
      setSections(splitIntoSections(res.content));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDownload() {
    if (!result) return;
    setDownloading(true);
    try {
      await proposalsApi.exportDocx(result.proposal_id, clientName || "proposal");
    } catch (err: unknown) {
      setError("Download failed: " + (err instanceof Error ? err.message : "unknown error"));
    } finally {
      setDownloading(false);
    }
  }

  async function submitRating(rating: number) {
    if (!result || ratingSubmitted) return;
    setRatingLoading(true);
    try {
      await proposalsApi.update(result.proposal_id, { quality_score: rating });
      setRatingSubmitted(true);
    } catch (e) {
      console.error("Rating failed:", e);
    } finally {
      setRatingLoading(false);
    }
  }

  function handleStarChange(rating: number) {
    setStarRating(rating);
    submitRating(rating);
  }

  function toggleSectionMode() {
    setSectionMode((prev) => !prev);
    setEditingSection(null);
  }

  function updateSection(idx: number, newBody: string) {
    setSections((prev) => prev.map((s, i) => i === idx ? { ...s, body: newBody } : s));
  }

  function reassembleContent(): string {
    return sections.map((s) => (s.heading ? `## ${s.heading}\n\n${s.body}` : s.body)).join("\n\n");
  }

  const coldStartPct = proposalsIndexed !== null
    ? Math.min((proposalsIndexed / COLD_START_THRESHOLD) * 100, 100)
    : null;

  return (
    <div className="min-h-screen" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="fade-up">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Generate a Proposal</h1>
          <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>
            Powered by Claude Sonnet + your Context-Mapper institutional memory.
          </p>
        </div>

        {!isProfessional && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3 fade-up-1">
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

        {/* Cold-start gap indicator */}
        {isProfessional && coldStartPct !== null && coldStartPct < 100 && (
          <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 fade-up-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-indigo-800">
                Context-Mapper warming up — {proposalsIndexed}/{COLD_START_THRESHOLD} proposals indexed
              </span>
              <span className="text-xs text-indigo-600">{Math.round(coldStartPct)}%</span>
            </div>
            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${coldStartPct}%`, background: "var(--indigo)" }}
              />
            </div>
            <p className="text-xs text-indigo-600 mt-2">
              Upload {COLD_START_THRESHOLD - (proposalsIndexed ?? 0)} more past proposals to unlock full personalization.{" "}
              <Link href="/onboarding" className="underline">Upload now →</Link>
            </p>
          </div>
        )}

        {/* Input panel */}
        <div className="bg-white border rounded-2xl p-6 space-y-5 shadow-sm fade-up-2" style={{ borderColor: "var(--vellum-border)" }}>
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink-secondary)" }}>
              Client name <span className="font-normal" style={{ color: "var(--ink-muted)" }}>(optional)</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="e.g. Brightfield Technologies"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              style={{ borderColor: "var(--vellum-border)" }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink-secondary)" }}>
              Deal value <span className="font-normal" style={{ color: "var(--ink-muted)" }}>(USD, optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-sm" style={{ color: "var(--ink-muted)" }}>$</span>
              <input
                type="number"
                value={valueUsd}
                onChange={(e) => setValueUsd(e.target.value)}
                placeholder="12500"
                className="w-full border rounded-lg pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ borderColor: "var(--vellum-border)" }}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: "var(--ink-secondary)" }}>
              RFP / Brief <span className="text-red-400">*</span>
            </label>
            <textarea
              value={rfpText}
              onChange={(e) => setRfpText(e.target.value)}
              rows={8}
              placeholder="Paste the client's RFP, project brief, or describe what they need…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
              style={{ borderColor: "var(--vellum-border)" }}
            />
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs" style={{ color: "var(--ink-muted)" }}>{rfpText.length} chars (min 50)</span>
              <div className="flex gap-2">
                {EXAMPLE_RFPS.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setRfpText(ex)}
                    className="text-xs hover:underline"
                    style={{ color: "var(--indigo)" }}
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
            className="w-full text-white font-medium py-3 rounded-xl text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ background: generating ? "var(--indigo-hover)" : "var(--indigo)" }}
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
          <div className="bg-white border rounded-2xl p-6 space-y-4 shadow-sm fade-up" style={{ borderColor: "var(--vellum-border)" }}>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                Generated Proposal {clientName ? `for ${clientName}` : ""}
              </h2>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={toggleSectionMode}
                  className={`flex items-center gap-1.5 text-sm px-4 py-2 rounded-lg transition-colors border ${
                    sectionMode
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {sectionMode ? "✎ Editing sections" : "✎ Edit sections"}
                </button>
                <button
                  onClick={handleDownload}
                  disabled={downloading}
                  className="flex items-center gap-1.5 text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: "var(--indigo)" }}
                >
                  {downloading ? "Downloading…" : "⬇ Download .docx"}
                </button>
                <Link
                  href="/dashboard"
                  className="flex items-center gap-1.5 border text-sm px-4 py-2 rounded-lg hover:bg-gray-50"
                  style={{ borderColor: "var(--vellum-border)", color: "var(--ink-secondary)" }}
                >
                  View in Dashboard →
                </Link>
              </div>
            </div>

            {/* Section editing mode */}
            {sectionMode ? (
              <div className="space-y-3">
                {sections.map((section, idx) => (
                  <div
                    key={idx}
                    className={`border rounded-xl overflow-hidden ${
                      editingSection === idx ? "border-indigo-400" : "border-gray-200"
                    }`}
                  >
                    <button
                      onClick={() => setEditingSection(editingSection === idx ? null : idx)}
                      className="w-full px-4 py-3 text-left flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-semibold text-sm" style={{ color: "var(--ink-primary)" }}>
                        {section.heading || "Introduction"}
                      </span>
                      <span className="text-xs" style={{ color: "var(--ink-muted)" }}>
                        {editingSection === idx ? "▲ Collapse" : "▼ Edit"}
                      </span>
                    </button>
                    {editingSection === idx && (
                      <textarea
                        value={section.body}
                        onChange={(e) => updateSection(idx, e.target.value)}
                        rows={8}
                        className="w-full px-4 py-3 text-sm border-t border-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none font-mono"
                        style={{ color: "var(--ink-secondary)" }}
                      />
                    )}
                    {editingSection !== idx && (
                      <div className="px-4 py-3 text-xs line-clamp-2 font-mono" style={{ color: "var(--ink-muted)" }}>
                        {section.body.slice(0, 120)}…
                      </div>
                    )}
                  </div>
                ))}
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      if (result) {
                        setResult({ ...result, content: reassembleContent() });
                      }
                      setSectionMode(false);
                    }}
                    className="text-sm text-white px-4 py-2 rounded-lg"
                    style={{ background: "var(--indigo)" }}
                  >
                    Save edits
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-xl p-4 max-h-[500px] overflow-y-auto" style={{ background: "var(--vellum)" }}>
                <div className="prose prose-sm prose-gray max-w-none leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                  <ReactMarkdown>{result.content}</ReactMarkdown>
                </div>
              </div>
            )}

            {/* Star rating widget */}
            <div className="pt-3 border-t border-gray-100">
              <p className="text-sm font-medium mb-2" style={{ color: "var(--ink-secondary)" }}>How good was this proposal?</p>
              {ratingSubmitted ? (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <span>✓</span>
                  <span>Thanks — your rating helps improve future proposals.</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <StarRating value={starRating} onChange={handleStarChange} />
                  {ratingLoading && (
                    <span className="text-xs animate-pulse" style={{ color: "var(--ink-muted)" }}>Saving…</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 text-xs font-mono" style={{ color: "var(--ink-muted)" }}>
              <span className="w-2 h-2 rounded-full" style={{ background: "var(--indigo)" }} />
              Generated with Claude Sonnet 4.6 + your Context-Mapper · ID: {result.proposal_id.slice(0, 8)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={null}>
      <NewProposalInner />
    </Suspense>
  );
}
