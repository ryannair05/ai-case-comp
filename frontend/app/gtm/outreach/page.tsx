"use client";

/**
 * Outreach sequence builder — /gtm/outreach
 * Generate a personalised multi-email outreach sequence using
 * the firm's Context-Mapper win stories for social proof.
 */
import { useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";

type Email = {
  subject: string;
  body: string;
  send_day: number;
  cta: string;
};

type SequenceResult = {
  sequence: Email[];
  ai_disclosure: string;
};

const INDUSTRIES = [
  "Marketing & Advertising",
  "Consulting",
  "Legal",
  "Accounting & Finance",
  "Technology",
  "Healthcare",
  "Real Estate",
  "Education",
  "Other",
];

export default function OutreachPage() {
  const [form, setForm] = useState({
    prospect_name: "",
    prospect_company: "",
    prospect_industry: "Marketing & Advertising",
    pain_point: "",
    sequence_length: 4,
  });
  const [result, setResult] = useState<SequenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<number | null>(null);

  function update(field: keyof typeof form, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pain_point.trim()) {
      setError("Please describe the prospect's main pain point.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await gtmApi.buildOutreach(form);
      setResult(data);
    } catch (err: any) {
      setError(err.message ?? "Sequence generation failed.");
    } finally {
      setLoading(false);
    }
  }

  async function copyEmail(index: number, email: Email) {
    const text = `Subject: ${email.subject}\n\n${email.body}\n\nCTA: ${email.cta}`;
    await navigator.clipboard.writeText(text);
    setCopied(index);
    setTimeout(() => setCopied(null), 2000);
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
          <Link href="/gtm">GTM Agent</Link>
          <Link href="/gtm/outreach" className="text-teal-600 font-medium">
            Outreach
          </Link>
          <Link href="/pipeline">Pipeline</Link>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">Outreach Sequence Builder</h1>
            <span className="bg-purple-100 text-purple-700 text-xs px-2 py-0.5 rounded-full font-medium">
              Phase 2
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            Generate a personalised multi-email outreach sequence. Draftly pulls your past win
            stories from Context-Mapper to add credible social proof.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleGenerate} className="bg-white border border-gray-100 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prospect name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.prospect_name}
                onChange={(e) => update("prospect_name", e.target.value)}
                placeholder="e.g. Sarah Chen"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Prospect company <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.prospect_company}
                onChange={(e) => update("prospect_company", e.target.value)}
                placeholder="e.g. Acme Corp"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Industry</label>
              <select
                value={form.prospect_industry}
                onChange={(e) => update("prospect_industry", e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {INDUSTRIES.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sequence length
              </label>
              <select
                value={form.sequence_length}
                onChange={(e) => update("sequence_length", parseInt(e.target.value, 10))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {[2, 3, 4, 5, 6].map((n) => (
                  <option key={n} value={n}>
                    {n} emails
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Main pain point / goal <span className="text-red-400">*</span>
            </label>
            <textarea
              value={form.pain_point}
              onChange={(e) => update("pain_point", e.target.value)}
              rows={3}
              placeholder="e.g. Struggling to win retainer clients; proposals take 6+ hours and often lose on price."
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
            {loading ? "Generating sequence…" : "Generate outreach sequence"}
          </button>
        </form>

        {/* Results */}
        {result && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900">Your {result.sequence.length}-email sequence</h2>

            {result.sequence.map((email, i) => (
              <div key={i} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="bg-teal-100 text-teal-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      Email {i + 1}
                    </span>
                    <span className="text-xs text-gray-400">Send day {email.send_day}</span>
                  </div>
                  <button
                    onClick={() => copyEmail(i, email)}
                    className="text-xs text-teal-600 hover:underline"
                  >
                    {copied === i ? "Copied!" : "Copy"}
                  </button>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 mb-0.5">SUBJECT</div>
                  <div className="text-sm font-medium text-gray-900">{email.subject}</div>
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 mb-0.5">BODY</div>
                  <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                    {email.body}
                  </div>
                </div>

                <div className="border-t border-gray-50 pt-3">
                  <div className="text-xs font-medium text-gray-500 mb-0.5">CTA</div>
                  <div className="text-sm text-teal-600 font-medium">{email.cta}</div>
                </div>
              </div>
            ))}

            {/* AI disclosure */}
            <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-xs text-gray-400">
              <strong className="text-gray-500">AI Disclosure:</strong> {result.ai_disclosure}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
