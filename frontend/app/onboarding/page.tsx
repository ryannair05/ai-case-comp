"use client";

/**
 * Screen 3: 4-step onboarding wizard.
 * If customers don't upload their proposals and pricing data, the moat never forms.
 * This wizard must make the 30-minute setup feel effortless.
 */
import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { ingestApi } from "@/lib/api";

const STEPS = [
  {
    id: 1,
    title: "Upload Pricing Sheet",
    desc: "Download our CSV template, fill in your services and prices, upload it back.",
    icon: "💰",
  },
  {
    id: 2,
    title: "Connect Your CRM",
    desc: "Connect HubSpot or Pipedrive to pull in client history automatically.",
    icon: "🔗",
  },
  {
    id: 3,
    title: "Upload Past Proposals",
    desc: "Upload 5–10 of your best proposals. PDF or Word both work.",
    icon: "📄",
  },
  {
    id: 4,
    title: "Define Your Brand Voice",
    desc: "Answer 5 quick questions so Draftly writes exactly like you.",
    icon: "🎨",
  },
];

const BRAND_VOICE_QUESTIONS = [
  { key: "tone", label: "How would you describe your firm's tone?", placeholder: "e.g. authoritative, warm, data-driven" },
  { key: "signature", label: "What's your firm's signature phrase or tagline?", placeholder: "e.g. Results you can measure, stories worth telling" },
  { key: "avoid", label: "What words or styles do you avoid?", placeholder: "e.g. jargon, excessive adjectives, passive voice" },
  { key: "structure", label: "Preferred proposal structure?", placeholder: "e.g. Problem → Insight → Solution → Evidence → Investment" },
  { key: "differentiator", label: "What makes your firm unique?", placeholder: "e.g. 73% win rate, data-first methodology, 90-day ROI guarantee" },
];

function SwitchingCostPreview({ count }: { count: number }) {
  const cost =
    count >= 50 ? "$33,000+" : count >= 20 ? "$12,000–18,000" : count >= 5 ? "$2,000–5,000" : null;
  if (!cost) return null;
  return (
    <div className="mt-3 bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-700">
      ✓ Context-Mapper is learning your firm.
      <span className="font-bold ml-1">Estimated switching cost: {cost}</span>
    </div>
  );
}

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [proposalsIndexed, setProposalsIndexed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadJobs, setUploadJobs] = useState<string[]>([]);
  const [brandVoice, setBrandVoice] = useState<Record<string, string>>({});
  const [crmChoice, setCrmChoice] = useState<"hubspot" | "pipedrive" | null>(null);

  // ---------------------------------------------------------------------------
  // Step 1: Pricing CSV
  // ---------------------------------------------------------------------------
  const onDropPricing = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setUploading(true);
    try {
      const result = await ingestApi.uploadPricingCsv(file);
      console.log("Pricing job:", result.job_id);
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
  }, []);

  const pricingDropzone = useDropzone({
    onDrop: onDropPricing,
    accept: { "text/csv": [".csv"] },
    maxFiles: 1,
  });

  // ---------------------------------------------------------------------------
  // Step 3: Proposal files
  // ---------------------------------------------------------------------------
  const onDropProposals = useCallback(async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      try {
        const result = await ingestApi.uploadProposalFile(file, {});
        setUploadJobs((prev) => [...prev, result.job_id]);
        setProposalsIndexed((n) => n + 1);
      } catch (e) {
        console.error(e);
      }
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

  // ---------------------------------------------------------------------------
  // Step 4: Brand voice submission
  // ---------------------------------------------------------------------------
  async function submitBrandVoice() {
    setUploading(true);
    try {
      const exampleText = Object.entries(brandVoice)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n");
      await ingestApi.uploadProposalFile(
        new File([exampleText], "brand_voice.txt", { type: "text/plain" }),
        {}
      );
    } catch (e) {
      console.error(e);
    }
    setUploading(false);
    // Redirect to dashboard after onboarding
    window.location.href = "/dashboard";
  }

  const progressPct = ((step - 1) / STEPS.length) * 100;
  const isLastStep = step === STEPS.length;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-2xl font-bold text-teal-600">Draftly</span>
          <p className="text-gray-500 text-sm mt-1">Build your proposal moat in 30 minutes</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between text-sm text-gray-500 mb-2">
              <span>Step {step} of {STEPS.length}</span>
              <span className="text-teal-600 font-medium">{proposalsIndexed} proposals indexed</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-2 bg-teal-500 rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <SwitchingCostPreview count={proposalsIndexed} />
          </div>

          {/* Step header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-3xl">{STEPS[step - 1].icon}</span>
              <div>
                <h2 className="text-xl font-bold text-gray-900">{STEPS[step - 1].title}</h2>
                <p className="text-gray-500 text-sm">{STEPS[step - 1].desc}</p>
              </div>
            </div>
          </div>

          {/* Step content */}
          {step === 1 && (
            <div className="space-y-4">
              <a
                href="/templates/pricing_template.csv"
                download
                className="flex items-center gap-2 text-sm text-teal-600 hover:underline"
              >
                ↓ Download pricing CSV template
              </a>
              <div
                {...pricingDropzone.getRootProps()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-teal-400 transition-colors"
              >
                <input {...pricingDropzone.getInputProps()} />
                <p className="text-gray-400 text-sm">
                  {uploading ? "Uploading…" : "Drop your pricing CSV here, or click to browse"}
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setCrmChoice("hubspot")}
                  className={`border-2 rounded-xl p-6 text-left transition-all ${
                    crmChoice === "hubspot"
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">HubSpot</div>
                  <div className="text-sm text-gray-500">Connect CRM deals & contacts</div>
                </button>
                <button
                  onClick={() => setCrmChoice("pipedrive")}
                  className={`border-2 rounded-xl p-6 text-left transition-all ${
                    crmChoice === "pipedrive"
                      ? "border-teal-500 bg-teal-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="font-bold text-gray-900 mb-1">Pipedrive</div>
                  <div className="text-sm text-gray-500">Connect pipeline & deals</div>
                </button>
              </div>
              {crmChoice && (
                <button
                  onClick={() =>
                    window.location.href === `/api/crm/${crmChoice}/connect`
                  }
                  className="w-full bg-teal-500 text-white py-3 rounded-lg font-medium"
                >
                  Connect {crmChoice === "hubspot" ? "HubSpot" : "Pipedrive"} →
                </button>
              )}
              <button
                onClick={() => setStep(3)}
                className="w-full text-sm text-gray-400 hover:text-gray-600"
              >
                Skip for now
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div
                {...proposalDropzone.getRootProps()}
                className="border-2 border-dashed border-gray-200 rounded-xl p-10 text-center cursor-pointer hover:border-teal-400 transition-colors"
              >
                <input {...proposalDropzone.getInputProps()} />
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-700 font-medium mb-1">
                  {uploading ? `Indexing…` : "Drop proposals here"}
                </p>
                <p className="text-gray-400 text-sm">PDF or DOCX · Multiple files OK</p>
              </div>
              {proposalsIndexed > 0 && (
                <div className="flex items-center gap-2 text-sm text-teal-600">
                  <span className="w-2 h-2 bg-teal-500 rounded-full animate-pulse" />
                  {proposalsIndexed} proposal{proposalsIndexed !== 1 ? "s" : ""} indexed and learning
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {BRAND_VOICE_QUESTIONS.map((q) => (
                <div key={q.key}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {q.label}
                  </label>
                  <input
                    type="text"
                    placeholder={q.placeholder}
                    value={brandVoice[q.key] ?? ""}
                    onChange={(e) =>
                      setBrandVoice((prev) => ({ ...prev, [q.key]: e.target.value }))
                    }
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-teal-500"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 mt-8">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="flex-1 border border-gray-200 text-gray-600 py-3 rounded-lg font-medium hover:bg-gray-50"
              >
                ← Back
              </button>
            )}
            <button
              onClick={isLastStep ? submitBrandVoice : () => setStep(step + 1)}
              disabled={uploading}
              className="flex-1 bg-teal-500 hover:bg-teal-400 disabled:bg-gray-200 text-white py-3 rounded-lg font-bold transition-colors"
            >
              {isLastStep
                ? "Complete Setup →"
                : step === 2
                ? "Continue →"
                : "Continue →"}
            </button>
          </div>
        </div>

        {/* Footer context */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Each proposal you upload deepens your moat.
          At 50 proposals, your switching cost exceeds $15,000.
        </p>
      </div>
    </div>
  );
}
