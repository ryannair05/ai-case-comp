"use client";

import { useState } from "react";
import { gtmApi } from "@/lib/api";
import { OutreachEmail } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

const SEQUENCE_LENGTHS = [3, 4, 5, 7] as const;

interface OutreachForm {
  name: string;
  company: string;
  industry: string;
  painPoint: string;
}

export default function OutreachPage() {
  const [form, setForm] = useState<OutreachForm>({ name: "", company: "", industry: "", painPoint: "" });
  const [sequenceLength, setSequenceLength] = useState<number>(3);
  const [loading, setLoading] = useState(false);
  const [sequence, setSequence] = useState<OutreachEmail[] | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!form.name || !form.company) {
      setError("Prospect name and company are required.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await gtmApi.generateOutreachSequence(
        form.name,
        form.company,
        form.industry,
        form.painPoint,
        sequenceLength
      );
      setSequence(res as OutreachEmail[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  async function handleCopy(email: OutreachEmail, idx: number) {
    const text = `Subject: ${email.subject}\n\n${email.body}${email.cta ? `\n\nCTA: ${email.cta}` : ""}`;
    await navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  function handleExportCsv() {
    if (!sequence) return;
    const header = "send_day,subject,body,cta";
    const rows = sequence.map((email, i) => {
      const day = email.send_day ?? (i + 1);
      const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
      return `${day},${escapeCsv(email.subject)},${escapeCsv(email.body)},${escapeCsv(email.cta ?? "")}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `outreach_sequence_${form.company.replace(/\s+/g, "_").toLowerCase() || "export"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <div className="max-w-5xl mx-auto p-6 mt-6 flex flex-col md:flex-row gap-8">
        {/* Left Col: Setup */}
        <div className="md:w-80 shrink-0 space-y-4 fade-up">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
            Outreach Sequence
          </h1>
          <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>
            Hyper-personalized email drip using your Context-Mapper win stories.
          </p>

          <div className="bg-white p-6 rounded-xl border shadow-sm space-y-4" style={{ borderColor: "var(--vellum-border)" }}>
            {[
              { key: "name" as const, label: "Prospect Name", placeholder: "Jane Doe" },
              { key: "company" as const, label: "Company", placeholder: "Stark Industries" },
              { key: "industry" as const, label: "Industry", placeholder: "Defense Tech" },
              { key: "painPoint" as const, label: "Pain Point", placeholder: "Scaling costs and compliance…" },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>
                  {label}
                </label>
                <input
                  type="text"
                  className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  style={{ borderColor: "var(--vellum-border)" }}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  placeholder={placeholder}
                />
              </div>
            ))}

            {/* Sequence length dropdown */}
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>
                Sequence length
              </label>
              <select
                value={sequenceLength}
                onChange={(e) => setSequenceLength(Number(e.target.value))}
                className="w-full border rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ borderColor: "var(--vellum-border)" }}
              >
                {SEQUENCE_LENGTHS.map((n) => (
                  <option key={n} value={n}>
                    {n} emails
                  </option>
                ))}
              </select>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-xs rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <button
              disabled={loading}
              onClick={handleGenerate}
              className="w-full text-white font-medium py-2 rounded-lg transition-colors disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {loading ? "Generating…" : `Generate ${sequenceLength}-Step Sequence`}
            </button>
          </div>
        </div>

        {/* Right Col: Output */}
        <div className="flex-1 fade-up-1">
          {sequence ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>
                  Generated Sequence
                </h2>
                <button
                  onClick={handleExportCsv}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors hover:bg-gray-50 flex items-center gap-1.5"
                  style={{ borderColor: "var(--vellum-border)", color: "var(--indigo)" }}
                >
                  ↓ Export CSV
                </button>
              </div>
              {sequence.map((email, i) => (
                <div key={i} className="bg-white border rounded-xl p-5 shadow-sm card-hover" style={{ borderColor: "var(--vellum-border)" }}>
                  <div className="flex justify-between items-center mb-3">
                    <span
                      className="text-xs font-bold px-2 py-1 rounded"
                      style={{ background: "rgba(99,102,241,0.1)", color: "var(--indigo)" }}
                    >
                      Day {email.send_day ?? (i + 1)}
                    </span>
                    <button
                      onClick={() => handleCopy(email, i)}
                      className="text-xs font-medium px-3 py-1 rounded-lg border transition-colors"
                      style={{
                        borderColor: copied === i ? "#10B981" : "var(--vellum-border)",
                        color: copied === i ? "#10B981" : "var(--ink-secondary)",
                        background: copied === i ? "rgba(16,185,129,0.07)" : "transparent",
                      }}
                    >
                      {copied === i ? "✓ Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="text-sm font-bold mb-2" style={{ color: "var(--ink-primary)" }}>
                    Subject: {email.subject}
                  </div>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                    {email.body}
                  </div>
                  {email.cta && (
                    <div className="mt-4 pt-3 border-t text-sm font-medium" style={{ borderColor: "var(--vellum-border)", color: "var(--indigo)" }}>
                      CTA: {email.cta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              className="h-full border-2 border-dashed rounded-xl flex items-center justify-center p-8 text-center"
              style={{ borderColor: "var(--vellum-border)", color: "var(--ink-muted)" }}
            >
              Fill out the prospect details to generate a personalized sequence blending your product value with relevant case studies.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
