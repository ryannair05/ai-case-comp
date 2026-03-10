"use client";

/**
 * Screen 3: 4-step onboarding wizard.
 * #13: Persist step completion to localStorage (draftly_onboarding_steps).
 */
import { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { ingestApi, contextMapperApi } from "@/lib/api";

const STEPS = [
  { id: 1, title: "Upload Pricing Sheet", desc: "Download our CSV template, fill in your services and prices, upload it back.", icon: "💰" },
  { id: 2, title: "Connect Your CRM", desc: "Connect HubSpot or Pipedrive to pull in client history automatically.", icon: "🔗" },
  { id: 3, title: "Upload Past Proposals", desc: "Upload 5–10 of your best proposals. PDF or Word both work.", icon: "📄" },
  { id: 4, title: "Define Your Brand Voice", desc: "Answer 5 quick questions so Draftly writes exactly like you.", icon: "🎨" },
];

const BRAND_VOICE_QUESTIONS = [
  { key: "tone", label: "How would you describe your firm's tone?", placeholder: "e.g. authoritative, warm, data-driven" },
  { key: "signature", label: "What's your firm's signature phrase or tagline?", placeholder: "e.g. Results you can measure, stories worth telling" },
  { key: "avoid", label: "What words or styles do you avoid?", placeholder: "e.g. jargon, excessive adjectives, passive voice" },
  { key: "structure", label: "Preferred proposal structure?", placeholder: "e.g. Problem → Insight → Solution → Evidence → Investment" },
  { key: "differentiator", label: "What makes your firm unique?", placeholder: "e.g. 73% win rate, data-first methodology, 90-day ROI guarantee" },
];

const LS_KEY = "draftly_onboarding_steps";

function SwitchingCostPreview({ count }: { count: number }) {
  const cost =
    count >= 50 ? "$33,000+" : count >= 20 ? "$12,000–18,000" : count >= 5 ? "$2,000–5,000" : null;
  if (!cost) return null;
  return (
    <div className="mt-3 border rounded-lg p-3 text-sm" style={{ background: "rgba(99,102,241,0.05)", borderColor: "rgba(99,102,241,0.2)", color: "var(--indigo)" }}>
      ✓ Context-Mapper is learning your firm.
      <span className="font-bold ml-1">Estimated switching cost: {cost}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [proposalsIndexed, setProposalsIndexed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [brandVoice, setBrandVoice] = useState<Record<string, string>>({});
  const [crmChoice, setCrmChoice] = useState<"hubspot" | "pipedrive" | null>(null);

  // Restore step from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { step?: number };
        if (parsed.step && parsed.step >= 1 && parsed.step <= STEPS.length) {
          setStep(parsed.step);
        }
      }
    } catch {
      // ignore
    }

    // Also fetch current proposal count
    contextMapperApi.status()
      .then((s) => { if (s?.proposals_indexed) setProposalsIndexed(s.proposals_indexed); })
      .catch(() => { });
  }, []);

  function persistStep(s: number) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ step: s }));
    } catch {
      // ignore
    }
  }

  function advanceStep() {
    const next = step + 1;
    setStep(next);
    persistStep(next);
  }

  function goBack() {
    const prev = step - 1;
    setStep(prev);
    persistStep(prev);
  }

  // Step 1: Pricing CSV
  const onDropPricing = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      await ingestApi.uploadPricingCsv(file);
    } catch (e) { console.error(e); }
    setUploading(false);
  }, []);

  const pricingDropzone = useDropzone({
    onDrop: onDropPricing,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  // Step 3: Proposal files
  const onDropProposals = useCallback(async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        await ingestApi.uploadProposalFile(file, {});
        setProposalsIndexed((n) => n + 1);
      } catch (e) { console.error(e); }
    }
    setUploading(false);
  }, []);

  const proposalDropzone = useDropzone({
    onDrop: onDropProposals,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    },
    multiple: true,
  });

  // Step 4: Brand voice
  async function submitBrandVoice() {
    setUploading(true);
    try {
      const exampleText = brandVoice.differentiator ?? "";
      const styleNotes = [
        brandVoice.structure ? `Structure: ${brandVoice.structure}` : "",
        brandVoice.avoid ? `Avoid: ${brandVoice.avoid}` : "",
        brandVoice.signature ? `Signature: ${brandVoice.signature}` : "",
      ].filter(Boolean).join(". ");
      const toneTags = brandVoice.tone ?? "";
      await ingestApi.uploadBrandVoice(exampleText, styleNotes, toneTags);
    } catch (e) { console.error(e); }
    setUploading(false);
    localStorage.removeItem(LS_KEY);
    window.location.href = "/dashboard";
  }

  const progressPct = ((step - 1) / STEPS.length) * 100;
  const isLastStep = step === STEPS.length;

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--vellum)" }}>
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8 fade-up">
          <span className="text-2xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--ink-primary)" }}>
            Draftly
          </span>
          <p className="text-sm mt-1" style={{ color: "var(--ink-secondary)" }}>Build your proposal moat in 30 minutes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border p-8 fade-up-1" style={{ borderColor: "var(--vellum-border)" }}>
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm mb-2" style={{ color: "var(--ink-secondary)" }}>
              <span>Step {step} of {STEPS.length}</span>
              <span className="font-mono" style={{ color: "var(--indigo)" }}>{proposalsIndexed} proposals indexed</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--vellum-border)" }}>
              <div
                className="h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: "var(--indigo)" }}
              />
            </div>
            <SwitchingCostPreview count={proposalsIndexed} />
          </div>

          {/* Step header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{STEPS[step - 1].icon}</span>
              <div>
                <h2 className="text-xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>{STEPS[step - 1].title}</h2>
                <p className="text-sm" style={{ color: "var(--ink-secondary)" }}>{STEPS[step - 1].desc}</p>
              </div>
            </div>
          </div>

          {/* Step content */}
          {step === 1 && (
            <div className="space-y-4">
              <a
                href="/templates/pricing_template.csv"
                download
                className="flex items-center gap-2 text-sm hover:underline"
                style={{ color: "var(--indigo)" }}
              >
                ↓ Download pricing CSV template
              </a>
              <div
                {...pricingDropzone.getRootProps()}
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors"
                style={{ borderColor: "var(--vellum-border)" }}
              >
                <input {...pricingDropzone.getInputProps()} />
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>
                  {uploading ? "Uploading…" : "Drop your pricing CSV here, or click to browse"}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {(["hubspot", "pipedrive"] as const).map((crm) => (
                  <button
                    key={crm}
                    onClick={() => setCrmChoice(crm)}
                    className="border-2 rounded-xl p-6 text-left transition-all"
                    style={{
                      borderColor: crmChoice === crm ? "var(--indigo)" : "var(--vellum-border)",
                      background: crmChoice === crm ? "rgba(99,102,241,0.05)" : "white",
                    }}
                  >
                    <div className="font-bold mb-1 capitalize" style={{ color: "var(--ink-primary)" }}>{crm === "hubspot" ? "HubSpot" : "Pipedrive"}</div>
                    <div className="text-sm" style={{ color: "var(--ink-secondary)" }}>
                      {crm === "hubspot" ? "Connect CRM deals & contacts" : "Connect pipeline & deals"}
                    </div>
                  </button>
                ))}
              </div>
              {crmChoice && (
                <button
                  onClick={() => { window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/crm/${crmChoice}/connect`; }}
                  className="w-full text-white py-3 rounded-lg font-medium"
                  style={{ background: "var(--indigo)" }}
                >
                  Connect {crmChoice === "hubspot" ? "HubSpot" : "Pipedrive"} →
                </button>
              )}
              <button
                onClick={advanceStep}
                className="w-full text-sm"
                style={{ color: "var(--ink-muted)" }}
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div
                {...proposalDropzone.getRootProps()}
                className="border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors"
                style={{ borderColor: "var(--vellum-border)" }}
              >
                <input {...proposalDropzone.getInputProps()} />
                <div className="text-4xl mb-3">📄</div>
                <p className="font-medium mb-1" style={{ color: "var(--ink-primary)" }}>
                  {uploading ? "Indexing…" : "Drop proposals here"}
                </p>
                <p className="text-sm" style={{ color: "var(--ink-muted)" }}>PDF or DOCX · Multiple files OK</p>
              </div>
              {proposalsIndexed > 0 && (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--indigo)" }}>
                  <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: "var(--indigo)" }} />
                  {proposalsIndexed} proposal{proposalsIndexed !== 1 ? "s" : ""} indexed and learning
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {BRAND_VOICE_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <label className="text-sm font-medium block mb-1" style={{ color: "var(--ink-secondary)" }}>
                    {q.label}
                  </label>
                  <input
                    type="text"
                    placeholder={q.placeholder}
                    value={brandVoice[q.key] ?? ""}
                    onChange={(e) => setBrandVoice((prev) => ({ ...prev, [q.key]: e.target.value }))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    style={{ borderColor: "var(--vellum-border)" }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={goBack}
                className="flex-1 border py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                style={{ borderColor: "var(--vellum-border)", color: "var(--ink-secondary)" }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={isLastStep ? submitBrandVoice : advanceStep}
              disabled={uploading}
              className="flex-1 text-white py-3 rounded-lg font-bold transition-colors disabled:opacity-50"
              style={{ background: "var(--indigo)" }}
            >
              {isLastStep ? "Complete Setup →" : "Continue →"}
            </button>
          </div>
        </div>

        <p className="text-center text-xs mt-4" style={{ color: "var(--ink-muted)" }}>
          Each proposal you upload deepens your moat. At 50 proposals, your switching cost exceeds $15,000.
        </p>
      </div>
    </div>
  );
}
