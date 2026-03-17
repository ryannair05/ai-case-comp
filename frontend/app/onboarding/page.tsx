"use client";

/**
 * Screen 3: 4-step onboarding wizard.
 * #13: Persist step completion to localStorage (draftly_onboarding_steps).
 * #14: Job polling for upload confirmation.
 * #15: CRM OAuth callback detection.
 */
import { useState, useCallback, useEffect, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ingestApi, contextMapperApi } from "@/lib/api";

const STEPS = [
  { id: 1, title: "Upload Pricing Sheet", desc: "Download our CSV template, fill in your services and prices, upload it back.", icon: "💰" },
  { id: 2, title: "Connect Your CRM", desc: "Connect HubSpot or Pipedrive to pull in client history automatically.", icon: "🔗" },
  { id: 3, title: "Upload Past Proposals", desc: "Upload 5–10 of your best proposals. PDF or Word both work.", icon: "📄" },
  { id: 4, title: "Define Your Brand Voice", desc: "Answer 5 quick questions so Draftly writes exactly like you.", icon: "🎨" },
];

const STEP_ICONS = [
  // Pricing sheet - dollar/chart
  <svg key="s1" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></svg>,
  // CRM - link
  <svg key="s2" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
  // Proposals - file stack
  <svg key="s3" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
  // Brand voice - pen/feather
  <svg key="s4" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" /><line x1="16" y1="8" x2="2" y2="22" /><line x1="17.5" y1="15" x2="9" y2="15" /></svg>,
];

const BRAND_VOICE_QUESTIONS = [
  { key: "tone", label: "How would you describe your firm's tone?", placeholder: "e.g. authoritative, warm, data-driven" },
  { key: "signature", label: "What's your firm's signature phrase or tagline?", placeholder: "e.g. Results you can measure, stories worth telling" },
  { key: "avoid", label: "What words or styles do you avoid?", placeholder: "e.g. jargon, excessive adjectives, passive voice" },
  { key: "structure", label: "Preferred proposal structure?", placeholder: "e.g. Problem → Insight → Solution → Evidence → Investment" },
  { key: "differentiator", label: "What makes your firm unique?", placeholder: "e.g. 73% win rate, data-first methodology, 90-day ROI guarantee" },
];

const LS_KEY = "draftly_onboarding_steps";

type FileStatus = "uploading" | "processing" | "indexed" | "failed";

interface UploadedFile {
  name: string;
  status: FileStatus;
  jobId?: string;
}

function SwitchingCostPreview({ count }: { count: number }) {
  const cost =
    count >= 50 ? "$33,000+" : count >= 20 ? "$12,000–18,000" : count >= 5 ? "$2,000–5,000" : null;
  if (!cost) return null;
  return (
    <div style={{
      marginTop: "12px",
      padding: "12px 16px",
      borderRadius: "10px",
      background: "rgba(99,102,241,0.08)",
      border: "1px solid rgba(99,102,241,0.15)",
      fontSize: "13px",
      color: "rgba(199,210,254,0.9)",
      fontFamily: "'DM Sans', sans-serif",
    }}>
      ✓ Context-Mapper is learning your firm.
      <span style={{ fontWeight: 700, marginLeft: "4px", color: "#A5B4FC" }}>Estimated switching cost: {cost}</span>
    </div>
  );
}

function OnboardingInner() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [proposalsIndexed, setProposalsIndexed] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [brandVoice, setBrandVoice] = useState<Record<string, string>>({});
  const [crmChoice, setCrmChoice] = useState<"hubspot" | "pipedrive" | null>(null);
  const [crmConnected, setCrmConnected] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const pollTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Detect CRM OAuth callback
  useEffect(() => {
    if (searchParams.get("crm") === "connected") {
      setCrmConnected(true);
      try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as { step?: number };
          if (parsed.step === 2) {
            setStep(3);
            persistStep(3);
          }
        }
      } catch { /* ignore */ }
    }
  }, [searchParams]);

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

    contextMapperApi.status()
      .then((s) => { if (s?.proposals_indexed) setProposalsIndexed(s.proposals_indexed); })
      .catch(() => { });
  }, []);

  // Cleanup poll timers
  useEffect(() => {
    return () => {
      pollTimers.current.forEach((timer) => clearInterval(timer));
    };
  }, []);

  function persistStep(s: number) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ step: s }));
    } catch { /* ignore */ }
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

  // Poll for job completion
  function startPolling(jobId: string, fileName: string) {
    const timer = setInterval(async () => {
      try {
        const status = await ingestApi.jobStatus(jobId);
        if (status.status === "completed" || status.status === "done") {
          clearInterval(timer);
          pollTimers.current.delete(jobId);
          setUploadedFiles((prev) =>
            prev.map((f) => (f.jobId === jobId ? { ...f, status: "indexed" as FileStatus } : f))
          );
          setProposalsIndexed((n) => n + 1);
        } else if (status.status === "failed" || status.status === "error") {
          clearInterval(timer);
          pollTimers.current.delete(jobId);
          setUploadedFiles((prev) =>
            prev.map((f) => (f.jobId === jobId ? { ...f, status: "failed" as FileStatus } : f))
          );
        }
      } catch {
        // Keep polling on network errors
      }
    }, 2000);
    pollTimers.current.set(jobId, timer);
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

  // Step 3: Proposal files with job polling
  const onDropProposals = useCallback(async (files: File[]) => {
    setUploading(true);
    for (const file of files) {
      const fileEntry: UploadedFile = { name: file.name, status: "uploading" };
      setUploadedFiles((prev) => [...prev, fileEntry]);

      try {
        const result = await ingestApi.uploadProposalFile(file, {});
        const jobId = result?.job_id;

        if (jobId) {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.name === file.name && f.status === "uploading" ? { ...f, status: "processing" as FileStatus, jobId } : f))
          );
          startPolling(jobId, file.name);
        } else {
          setUploadedFiles((prev) =>
            prev.map((f) => (f.name === file.name && f.status === "uploading" ? { ...f, status: "indexed" as FileStatus } : f))
          );
          setProposalsIndexed((n) => n + 1);
        }
      } catch (e) {
        console.error(e);
        setUploadedFiles((prev) =>
          prev.map((f) => (f.name === file.name && f.status === "uploading" ? { ...f, status: "failed" as FileStatus } : f))
        );
      }
    }
    setUploading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isLastStep = step === STEPS.length;

  const statusIcon = (status: FileStatus) => {
    switch (status) {
      case "uploading": return "⬆";
      case "processing": return "⏳";
      case "indexed": return "✓";
      case "failed": return "✗";
    }
  };

  const statusColor = (status: FileStatus) => {
    switch (status) {
      case "uploading": return "rgba(148,163,184,0.8)";
      case "processing": return "#818CF8";
      case "indexed": return "#34D399";
      case "failed": return "#F87171";
    }
  };

  return (
    <>
      <style>{`
        @keyframes onbMeshShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes onbNodePulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.4); }
          50% { box-shadow: 0 0 0 8px rgba(99,102,241,0); }
        }
        @keyframes onbFadeSlide {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes onbShapeFloat {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          33% { transform: translateY(-14px) rotate(5deg); }
          66% { transform: translateY(8px) rotate(-3deg); }
        }
        @keyframes onbShapeFloat2 {
          0%, 100% { transform: translateY(0) rotate(0deg); }
          40% { transform: translateY(12px) rotate(-4deg); }
          70% { transform: translateY(-8px) rotate(2deg); }
        }
        @keyframes onbGlowPulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        @keyframes shimmerCta {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes dropzoneBreath {
          0%, 100% { border-color: rgba(99,102,241,0.2); }
          50% { border-color: rgba(99,102,241,0.45); }
        }
        @keyframes progressGlow {
          0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.3); }
          50% { box-shadow: 0 0 20px rgba(99,102,241,0.5); }
        }

        .onb-input {
          width: 100%;
          padding: 12px 16px;
          border: 1.5px solid rgba(99,102,241,0.15);
          border-radius: 10px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #E2E8F0;
          background: rgba(255,255,255,0.04);
          transition: border-color 0.2s, box-shadow 0.2s, background 0.2s;
          outline: none;
        }
        .onb-input::placeholder {
          color: rgba(148,163,184,0.5);
        }
        .onb-input:focus {
          border-color: rgba(99,102,241,0.5);
          box-shadow: 0 0 0 3px rgba(99,102,241,0.1);
          background: rgba(255,255,255,0.06);
        }
      `}</style>

      <div style={{
        display: "flex",
        minHeight: "100vh",
        background: "#0B0F1A",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        {/* ═══ LEFT: Step Rail ═══ */}
        <div style={{
          flex: "0 0 320px",
          background: "linear-gradient(180deg, #1E1B4B 0%, #312E81 30%, #3730A3 60%, #1E1B4B 100%)",
          backgroundSize: "100% 200%",
          animation: "onbMeshShift 16s ease infinite",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "48px 36px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Floating geometric shapes */}
          <div style={{
            position: "absolute", top: "8%", right: "15%",
            width: "70px", height: "70px",
            border: "1.5px solid rgba(255,255,255,0.08)",
            borderRadius: "16px", transform: "rotate(20deg)",
            animation: "onbShapeFloat 9s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", bottom: "12%", left: "10%",
            width: "50px", height: "50px",
            border: "1.5px solid rgba(255,255,255,0.06)",
            borderRadius: "50%",
            animation: "onbShapeFloat2 11s ease-in-out infinite",
          }} />
          <div style={{
            position: "absolute", top: "45%", left: "70%",
            width: "35px", height: "35px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "8px", transform: "rotate(-15deg)",
            animation: "onbShapeFloat 13s ease-in-out infinite",
          }} />
          {/* Glow orb */}
          <div style={{
            position: "absolute", top: "25%", left: "50%",
            width: "160px", height: "160px",
            borderRadius: "50%",
            background: "rgba(129,140,248,0.08)",
            filter: "blur(50px)",
            animation: "onbGlowPulse 5s ease-in-out infinite",
          }} />

          {/* Branding */}
          <div style={{ position: "relative", zIndex: 1, marginBottom: "48px" }}>
            <span style={{
              fontFamily: "'Outfit', sans-serif",
              fontSize: "28px", fontWeight: 700,
              color: "#fff", letterSpacing: "-0.5px",
              display: "block", marginBottom: "8px",
            }}>
              Draftly
            </span>
            <p style={{
              fontSize: "13px", color: "rgba(255,255,255,0.5)",
              lineHeight: 1.6, margin: 0,
            }}>
              Build your proposal moat in 30&nbsp;minutes
            </p>
          </div>

          {/* Step Rail */}
          <div style={{ position: "relative", zIndex: 1 }}>
            {STEPS.map((s, i) => {
              const isActive = step === s.id;
              const isCompleted = step > s.id;
              const isFuture = step < s.id;

              return (
                <div key={s.id} style={{ display: "flex", gap: "16px", alignItems: "flex-start", position: "relative" }}>
                  {/* Vertical line */}
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "36px", flexShrink: 0 }}>
                    {/* Node */}
                    <div style={{
                      width: "36px", height: "36px",
                      borderRadius: "50%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: isCompleted
                        ? "linear-gradient(135deg, #6366F1, #818CF8)"
                        : isActive
                          ? "rgba(99,102,241,0.15)"
                          : "rgba(255,255,255,0.04)",
                      border: isActive
                        ? "2px solid #6366F1"
                        : isCompleted
                          ? "2px solid transparent"
                          : "1.5px solid rgba(255,255,255,0.1)",
                      color: isCompleted ? "#fff" : isActive ? "#A5B4FC" : "rgba(255,255,255,0.25)",
                      transition: "all 0.3s ease",
                      animation: isActive ? "onbNodePulse 2s ease-in-out infinite" : "none",
                      flexShrink: 0,
                    }}>
                      {isCompleted ? (
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <span style={{ display: "flex" }}>{STEP_ICONS[i]}</span>
                      )}
                    </div>
                    {/* Connector line */}
                    {i < STEPS.length - 1 && (
                      <div style={{
                        width: "2px", height: "48px",
                        background: isCompleted
                          ? "linear-gradient(180deg, #6366F1, rgba(99,102,241,0.3))"
                          : "rgba(255,255,255,0.06)",
                        transition: "background 0.5s ease",
                      }} />
                    )}
                  </div>

                  {/* Label */}
                  <div style={{ paddingTop: "6px", paddingBottom: i < STEPS.length - 1 ? "32px" : "0" }}>
                    <div style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "14px", fontWeight: isActive ? 600 : 400,
                      color: isCompleted ? "rgba(255,255,255,0.6)" : isActive ? "#fff" : "rgba(255,255,255,0.3)",
                      transition: "all 0.3s ease",
                      lineHeight: 1.4,
                    }}>
                      {s.title}
                    </div>
                    {isActive && (
                      <div style={{
                        fontSize: "12px",
                        color: "rgba(255,255,255,0.35)",
                        marginTop: "4px",
                        lineHeight: 1.4,
                        animation: "onbFadeSlide 0.3s ease both",
                      }}>
                        {s.desc}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Progress indicator */}
          <div style={{
            position: "relative", zIndex: 1,
            marginTop: "48px",
            padding: "14px 16px",
            borderRadius: "10px",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.4)", fontFamily: "'Outfit', sans-serif", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Progress
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "#A5B4FC" }}>
                {step - 1}/{STEPS.length}
              </span>
            </div>
            <div style={{
              height: "3px", borderRadius: "2px",
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%", borderRadius: "2px",
                width: `${((step - 1) / STEPS.length) * 100}%`,
                background: "linear-gradient(90deg, #6366F1, #818CF8)",
                transition: "width 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
                animation: "progressGlow 2s ease-in-out infinite",
              }} />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT: Content Area ═══ */}
        <div style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Subtle background grain */}
          <div style={{
            position: "absolute", inset: 0,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.02'/%3E%3C/svg%3E")`,
            pointerEvents: "none",
          }} />

          {/* Ambient glow orb top right */}
          <div style={{
            position: "absolute", top: "-10%", right: "-5%",
            width: "400px", height: "400px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{
            width: "100%", maxWidth: "560px",
            position: "relative", zIndex: 1,
          }}>
            {/* Content card */}
            <div
              key={step}
              style={{
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "20px",
                padding: "40px",
                backdropFilter: "blur(20px)",
                animation: "onbFadeSlide 0.35s ease both",
              }}
            >
              {/* Step header */}
              <div style={{ marginBottom: "32px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
                  <div style={{
                    width: "44px", height: "44px",
                    borderRadius: "12px",
                    background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(129,140,248,0.08))",
                    border: "1px solid rgba(99,102,241,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    color: "#A5B4FC",
                  }}>
                    {STEP_ICONS[step - 1]}
                  </div>
                  <div>
                    <h2 style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "22px", fontWeight: 600,
                      color: "#F1F5F9",
                      margin: 0, lineHeight: 1.3,
                    }}>
                      {STEPS[step - 1].title}
                    </h2>
                    <p style={{
                      fontSize: "13px",
                      color: "rgba(148,163,184,0.7)",
                      margin: "4px 0 0 0",
                    }}>
                      {STEPS[step - 1].desc}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Step 1: Pricing CSV ── */}
              {step === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <a
                    href="/templates/pricing_template.csv"
                    download
                    style={{
                      display: "inline-flex", alignItems: "center", gap: "8px",
                      fontSize: "13px", color: "#A5B4FC",
                      textDecoration: "none",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      background: "rgba(99,102,241,0.08)",
                      border: "1px solid rgba(99,102,241,0.12)",
                      transition: "all 0.2s",
                      alignSelf: "flex-start",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.14)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.25)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(99,102,241,0.08)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.12)"; }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                    Download pricing CSV template
                  </a>
                  <div
                    {...pricingDropzone.getRootProps()}
                    style={{
                      border: "2px dashed rgba(99,102,241,0.2)",
                      borderRadius: "16px",
                      padding: "48px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.3s",
                      background: pricingDropzone.isDragActive ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.01)",
                      animation: "dropzoneBreath 3s ease-in-out infinite",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.05)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.01)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                  >
                    <input {...pricingDropzone.getInputProps()} />
                    <div style={{ marginBottom: "12px", color: "#818CF8", fontSize: "28px" }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
                    </div>
                    <p style={{
                      fontSize: "14px", fontWeight: 500,
                      color: uploading ? "#818CF8" : "rgba(226,232,240,0.7)",
                      margin: "0 0 4px 0",
                    }}>
                      {uploading ? "Uploading…" : "Drop your pricing CSV here"}
                    </p>
                    <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.4)", margin: 0 }}>
                      or click to browse
                    </p>
                  </div>
                </div>
              )}

              {/* ── Step 2: CRM ── */}
              {step === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {crmConnected && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "12px",
                      padding: "14px 18px", borderRadius: "12px",
                      background: "rgba(52,211,153,0.08)",
                      border: "1px solid rgba(52,211,153,0.15)",
                    }}>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%",
                        background: "rgba(52,211,153,0.15)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        color: "#34D399",
                      }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      </div>
                      <div>
                        <div style={{ fontSize: "14px", fontWeight: 600, color: "#34D399" }}>CRM Connected</div>
                        <div style={{ fontSize: "12px", color: "rgba(52,211,153,0.6)", marginTop: "2px" }}>Your CRM data will sync automatically.</div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    {(["hubspot", "pipedrive"] as const).map((crm) => (
                      <button
                        key={crm}
                        onClick={() => setCrmChoice(crm)}
                        style={{
                          padding: "20px 18px",
                          borderRadius: "14px",
                          border: crmChoice === crm ? "1.5px solid rgba(99,102,241,0.4)" : "1.5px solid rgba(255,255,255,0.06)",
                          background: crmChoice === crm ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.02)",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.25s",
                          outline: "none",
                        }}
                        onMouseEnter={e => {
                          if (crmChoice !== crm) {
                            e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
                          }
                        }}
                        onMouseLeave={e => {
                          if (crmChoice !== crm) {
                            e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                            e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)";
                          }
                        }}
                      >
                        <div style={{
                          fontFamily: "'Outfit', sans-serif",
                          fontSize: "15px", fontWeight: 600,
                          color: crmChoice === crm ? "#C7D2FE" : "rgba(226,232,240,0.8)",
                          marginBottom: "4px",
                        }}>
                          {crm === "hubspot" ? "HubSpot" : "Pipedrive"}
                        </div>
                        <div style={{ fontSize: "12px", color: "rgba(148,163,184,0.5)" }}>
                          {crm === "hubspot" ? "Connect CRM deals & contacts" : "Connect pipeline & deals"}
                        </div>
                      </button>
                    ))}
                  </div>

                  {crmChoice && !crmConnected && (
                    <button
                      onClick={() => {
                        const afterAuth = encodeURIComponent("onboarding");
                        window.location.href = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/crm/${crmChoice}/connect?after_auth=${afterAuth}`;
                      }}
                      style={{
                        width: "100%", padding: "14px 24px",
                        border: "none", borderRadius: "12px",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "14px", fontWeight: 600,
                        color: "#fff", cursor: "pointer",
                        background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                        position: "relative", overflow: "hidden",
                        transition: "transform 0.15s, box-shadow 0.15s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.3)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                    >
                      Connect {crmChoice === "hubspot" ? "HubSpot" : "Pipedrive"} →
                    </button>
                  )}

                  <button
                    onClick={advanceStep}
                    style={{
                      width: "100%", padding: "10px",
                      background: "none", border: "none",
                      fontSize: "13px", color: "rgba(148,163,184,0.5)",
                      cursor: "pointer", fontFamily: "'DM Sans', sans-serif",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = "rgba(148,163,184,0.8)"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.5)"}
                  >
                    {crmConnected ? "Continue →" : "Skip for now"}
                  </button>
                </div>
              )}

              {/* ── Step 3: Proposals ── */}
              {step === 3 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div
                    {...proposalDropzone.getRootProps()}
                    style={{
                      border: "2px dashed rgba(99,102,241,0.2)",
                      borderRadius: "16px",
                      padding: "44px 24px",
                      textAlign: "center",
                      cursor: "pointer",
                      transition: "all 0.3s",
                      background: proposalDropzone.isDragActive ? "rgba(99,102,241,0.08)" : "rgba(255,255,255,0.01)",
                      animation: "dropzoneBreath 3s ease-in-out infinite",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(99,102,241,0.05)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.35)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.01)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                  >
                    <input {...proposalDropzone.getInputProps()} />
                    <div style={{ marginBottom: "12px", color: "#818CF8" }}>
                      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><polyline points="12 18 12 12" /><polyline points="9 15 12 12 15 15" /></svg>
                    </div>
                    <p style={{
                      fontSize: "15px", fontWeight: 500,
                      color: uploading ? "#818CF8" : "rgba(226,232,240,0.8)",
                      margin: "0 0 4px 0",
                    }}>
                      {uploading ? "Indexing…" : "Drop proposals here"}
                    </p>
                    <p style={{ fontSize: "12px", color: "rgba(148,163,184,0.4)", margin: 0 }}>
                      PDF or DOCX · Multiple files OK
                    </p>
                  </div>

                  {/* File status list */}
                  {uploadedFiles.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {uploadedFiles.map((file, i) => (
                        <div
                          key={`${file.name}-${i}`}
                          style={{
                            display: "flex", alignItems: "center", gap: "10px",
                            fontSize: "13px",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            background: "rgba(255,255,255,0.02)",
                            border: "1px solid rgba(255,255,255,0.04)",
                          }}
                        >
                          <span style={{
                            color: statusColor(file.status),
                            fontWeight: 600,
                            fontSize: "14px",
                            animation: file.status === "processing" ? "onbGlowPulse 1.5s ease-in-out infinite" : "none",
                          }}>
                            {statusIcon(file.status)}
                          </span>
                          <span style={{
                            flex: 1,
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            color: "rgba(226,232,240,0.6)",
                          }}>
                            {file.name}
                          </span>
                          <span style={{
                            fontSize: "11px", fontWeight: 600,
                            textTransform: "capitalize",
                            color: statusColor(file.status),
                            fontFamily: "'JetBrains Mono', monospace",
                          }}>
                            {file.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {proposalsIndexed > 0 && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: "8px",
                      fontSize: "13px", color: "#A5B4FC",
                    }}>
                      <span style={{
                        width: "6px", height: "6px", borderRadius: "50%",
                        background: "#818CF8",
                        boxShadow: "0 0 6px rgba(99,102,241,0.5)",
                      }} />
                      {proposalsIndexed} proposal{proposalsIndexed !== 1 ? "s" : ""} confirmed indexed
                    </div>
                  )}

                  <SwitchingCostPreview count={proposalsIndexed} />
                </div>
              )}

              {/* ── Step 4: Brand Voice ── */}
              {step === 4 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                  {BRAND_VOICE_QUESTIONS.map((q, i) => (
                    <div key={q.key} style={{ animation: `onbFadeSlide 0.3s ${i * 0.05}s ease both` }}>
                      <label style={{
                        display: "block",
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "13px", fontWeight: 500,
                        color: "rgba(226,232,240,0.7)",
                        marginBottom: "6px",
                      }}>
                        {q.label}
                      </label>
                      <input
                        type="text"
                        placeholder={q.placeholder}
                        value={brandVoice[q.key] ?? ""}
                        onChange={(e) => setBrandVoice((prev) => ({ ...prev, [q.key]: e.target.value }))}
                        className="onb-input"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* ── Navigation ── */}
              <div style={{ display: "flex", gap: "12px", marginTop: "32px" }}>
                {step > 1 && (
                  <button
                    onClick={goBack}
                    style={{
                      flex: 1,
                      padding: "14px 20px",
                      borderRadius: "12px",
                      border: "1.5px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.02)",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "14px", fontWeight: 500,
                      color: "rgba(226,232,240,0.5)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "rgba(226,232,240,0.8)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(226,232,240,0.5)"; }}
                  >
                    ← Back
                  </button>
                )}
                <button
                  onClick={isLastStep ? submitBrandVoice : advanceStep}
                  disabled={uploading}
                  style={{
                    flex: step > 1 ? 2 : 1,
                    padding: "14px 24px",
                    border: "none",
                    borderRadius: "12px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "15px", fontWeight: 600,
                    color: "#fff",
                    background: "linear-gradient(135deg, #6366F1, #4F46E5)",
                    cursor: uploading ? "not-allowed" : "pointer",
                    position: "relative",
                    overflow: "hidden",
                    transition: "transform 0.15s, box-shadow 0.15s",
                    opacity: uploading ? 0.5 : 1,
                  }}
                  onMouseEnter={e => { if (!uploading) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(99,102,241,0.35)"; } }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  {/* Shimmer overlay */}
                  <span style={{
                    position: "absolute", inset: 0,
                    background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)",
                    backgroundSize: "200% auto",
                    animation: "shimmerCta 3s linear 2s 2",
                  }} />
                  <span style={{ position: "relative" }}>
                    {isLastStep ? "Complete Setup →" : "Continue →"}
                  </span>
                </button>
              </div>
            </div>

            {/* Bottom note */}
            <p style={{
              textAlign: "center",
              fontSize: "11px",
              color: "rgba(148,163,184,0.3)",
              marginTop: "20px",
              fontFamily: "'DM Sans', sans-serif",
            }}>
              Each proposal you upload deepens your moat. At 50 proposals, your switching cost exceeds $15,000.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <OnboardingInner />
    </Suspense>
  );
}
