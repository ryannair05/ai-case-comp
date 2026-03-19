"use client";

/**
 * Draftly Live Demo — Light Editorial Aesthetic
 * Outfit headings + DM Sans body + JetBrains Mono code
 * Split-screen: Generic GPT vs Draftly Context-Mapper
 */
import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";

// ─── Sample data ────────────────────────────────────────────────────────────

const SAMPLE_RFPS = [
  {
    label: "B2B SaaS Go-to-Market",
    icon: "◈",
    text: `We are seeking a marketing agency to help us launch our new B2B SaaS product. We need a comprehensive go-to-market strategy including brand positioning, content marketing, paid media management, and lead generation. Our budget is flexible for the right partner.\n\nCompany: Meridian Analytics | Industry: B2B SaaS | Team: 25 people | Timeline: Q2 launch`,
  },
  {
    label: "Brand Refresh",
    icon: "◉",
    text: `Our accounting firm needs a complete brand refresh. We're targeting mid-market CFOs and want to modernize our visual identity, website, and thought leadership content. We have an existing client base of 200+ companies.\n\nCompany: Clearwater CPA | Industry: Professional Services | Timeline: 90 days`,
  },
  {
    label: "Product Launch Campaign",
    icon: "◎",
    text: `We're launching a new fintech product aimed at SMB owners. We need a full campaign: paid social, email sequences, influencer partnerships, and a launch event. We're series A funded with a $200K marketing budget.\n\nCompany: Vault Financial | Industry: Fintech | Timeline: 60 days to launch`,
  },
];

const LIONTOWN_DEMO_CUSTOMER_ID = "0d1a3e07-5d4a-5f7d-8be7-255a1109bce0";

// ─── Fallback fixtures (used when backend is unreachable) ─────────────────────

const FALLBACK_GENERIC = `## Proposal for Go-to-Market Strategy

Dear Hiring Manager,

Thank you for the opportunity to submit this proposal. We are a full-service marketing agency with extensive experience helping B2B companies grow.

### Our Approach
- **Brand Positioning**: We will conduct market research and develop a comprehensive brand strategy.
- **Content Marketing**: Our team will create blog posts, whitepapers, and social media content.
- **Paid Media**: We will manage paid campaigns across Google Ads and LinkedIn.
- **Lead Generation**: Using inbound and outbound strategies, we will build your pipeline.

### Pricing
Our standard engagement starts at a competitive rate. We offer flexible packages tailored to your needs.

### Timeline
We can begin within two weeks of engagement and deliver initial results within 60 days.

We look forward to discussing this further.

Best regards,
Generic Agency`;

const FALLBACK_DRAFTLY = `## LionTown Marketing — Proposal for Meridian Analytics

**Prepared by LionTown Marketing** | Win Rate: 73% | 847 proposals indexed

### Executive Summary
Meridian Analytics needs a partner who understands the B2B SaaS buyer journey — not just the funnel. LionTown has launched 23 SaaS products in the last 18 months with an average 73% win rate across competitive RFPs.

### Why LionTown
- **Proven SaaS Expertise**: Our Brightfield case study delivered 312% ROI in 90 days
- **Data-Driven Positioning**: We use brand_strategy frameworks validated across $8,500 avg deal sizes
- **Pricing Intelligence**: Based on 847 indexed proposals, we recommend a $4,500/mo retainer with performance bonuses

### Proposed Approach
1. **Discovery Sprint** (Weeks 1–2): Stakeholder interviews, competitive social_media_audit, ICP validation
2. **Brand Launch** (Weeks 3–6): Positioning, messaging matrix, content calendar
3. **Demand Engine** (Weeks 7–12): Paid media activation, ABM sequences, measurable pipeline targets

### Investment
- Monthly retainer: $4,500/mo (6-month minimum)
- Performance bonus: 10% of pipeline generated above $100K/quarter
- Estimated first-quarter ROI: 280% based on comparable B2B SaaS engagements

### Results you can measure
Every dollar is accountable. We provide weekly dashboards, monthly business reviews, and quarterly ROI audits.

*"We don't do marketing. We build revenue engines."* — LionTown Marketing`;

// ─── Feature cards data ─────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "context-mapper",
    label: "Context-Mapper",
    sublabel: "847 proposals indexed",
    description: "Every win, loss, and pricing anchor extracted into a private knowledge graph. Grows smarter with every proposal.",
    stat: "73%",
    statLabel: "win rate (Brightfield)",
    color: "indigo",
  },
  {
    id: "rag-pipeline",
    label: "RAG Pipeline",
    sublabel: "SIMD cosine similarity",
    description: "Local vector store with 1024-dim embeddings. No data ever leaves your environment. Threshold 0.72 for precision.",
    stat: "0.72",
    statLabel: "similarity threshold",
    color: "jade",
  },
  {
    id: "pricing-anchor",
    label: "Pricing Intelligence",
    sublabel: "$4,500 retainer floor",
    description: "Historical deal data surfaces the right price for every engagement. Never leave money on the table again.",
    stat: "$8.5K",
    statLabel: "avg deal value",
    color: "indigo",
  },
  {
    id: "docx-export",
    label: "DOCX Export",
    sublabel: "One-click delivery",
    description: "Fully formatted Word documents with your brand voice, heading styles, and pricing tables — ready to send.",
    stat: "<2s",
    statLabel: "generation time",
    color: "jade",
  },
];

// ─── Streaming helpers ───────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";

async function streamGenericGPT(
  rfp: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_URL}/demo/generic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp }),
    signal,
  });
  if (!res.ok) throw new Error(`Generic API returned ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let fullText = "";

  const readWithTimeout = () => {
    return Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
        setTimeout(() => reject(new Error("Stream read timeout")), 10000)
      )
    ]);
  };

  while (true) {
    const { done, value } = await readWithTimeout();
    if (done) break;
    const chunk = decoder.decode(value);
    fullText += chunk;
    onChunk(chunk);
  }
  if (!fullText.trim() || fullText.includes("[Stream Error") || fullText.includes("Error from OpenAI API")) {
    throw new Error("Generic stream failed or returned empty content");
  }
}

async function streamDraftly(
  rfp: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch(`${API_URL}/demo/draftly`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp, customer_id: LIONTOWN_DEMO_CUSTOMER_ID }),
    signal,
  });
  if (!res.ok) throw new Error(`Draftly API returned ${res.status}`);
  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body");
  const decoder = new TextDecoder();
  let fullText = "";

  const readWithTimeout = () => {
    return Promise.race([
      reader.read(),
      new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) =>
        setTimeout(() => reject(new Error("Stream read timeout")), 10000)
      )
    ]);
  };

  while (true) {
    const { done, value } = await readWithTimeout();
    if (done) break;
    const chunk = decoder.decode(value);
    fullText += chunk;
    onChunk(chunk);
  }
  if (!fullText.trim() || fullText.includes("[Stream Error")) {
    throw new Error("Draftly stream failed or returned empty content");
  }
}

// ─── Typewriter cursor component ─────────────────────────────────────────────

function TypewriterCursor({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-[2px] h-[1em] ml-[1px] align-middle ${active ? "animate-[blink_0.7s_step-end_infinite]" : "opacity-0"
        }`}
      style={{ background: "var(--indigo)" }}
    />
  );
}

// ─── Word-highlighted output ──────────────────────────────────────────────────

const DRAFTLY_KEYWORDS = [
  "$4,500", "$8,500", "$12,000", "retainer", "73%", "ROI", "LionTown",
  "Brightfield", "brand_strategy", "social_media_audit", "measurable",
  "accountable", "data-driven", "Results you can measure",
];

function HighlightedOutput({ text, isTyping }: { text: string; isTyping: boolean }) {
  if (!text) return null;

  return (
    <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-headings:mb-4 prose-headings:mt-6 first:prose-headings:mt-0 prose-pre:bg-gray-800 prose-pre:p-4 prose-pre:rounded-lg">
      <ReactMarkdown
        components={{
          p: ({ children }) => (
            <p className="mb-4 last:mb-0 inline-block last:inline">
              {children}
              {isTyping && <TypewriterCursor active={true} />}
            </p>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

// ─── Main Demo component ─────────────────────────────────────────────────────

export default function DemoPage() {
  const [selectedRfp, setSelectedRfp] = useState(0);
  const [customRfp, setCustomRfp] = useState("");
  const [isEditingRfp, setIsEditingRfp] = useState(false);
  const [genericStream, setGenericStream] = useState("");
  const [draftlyStream, setDraftlyStream] = useState("");
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [activeTab, setActiveTab] = useState<"demo" | "features" | "architecture">("demo");
  const [genericWordCount, setGenericWordCount] = useState(0);
  const [draftlyWordCount, setDraftlyWordCount] = useState(0);
  const [genericFallback, setGenericFallback] = useState(false);
  const [draftlyFallback, setDraftlyFallback] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const genericRef = useRef<HTMLDivElement>(null);
  const draftlyRef = useRef<HTMLDivElement>(null);

  const rfpText = customRfp || SAMPLE_RFPS[selectedRfp].text;

  // Auto-scroll output panels
  useEffect(() => {
    if (genericRef.current) {
      genericRef.current.scrollTop = genericRef.current.scrollHeight;
    }
  }, [genericStream]);

  useEffect(() => {
    if (draftlyRef.current) {
      draftlyRef.current.scrollTop = draftlyRef.current.scrollHeight;
    }
  }, [draftlyStream]);

  // Word count tracking
  useEffect(() => {
    setGenericWordCount(genericStream.trim().split(/\s+/).filter(Boolean).length);
  }, [genericStream]);

  useEffect(() => {
    setDraftlyWordCount(draftlyStream.trim().split(/\s+/).filter(Boolean).length);
  }, [draftlyStream]);

  const runDemo = useCallback(async () => {
    if (running) {
      abortRef.current?.abort();
      setRunning(false);
      return;
    }

    setRunning(true);
    setDone(false);
    setGenericStream("");
    setDraftlyStream("");
    setGenericWordCount(0);
    setDraftlyWordCount(0);
    setGenericFallback(false);
    setDraftlyFallback(false);

    const controller = new AbortController();
    abortRef.current = controller;

    // Run both streams independently so one failing doesn't block the other
    const genericPromise = streamGenericGPT(
      rfpText,
      (c) => setGenericStream((p) => p + c),
      controller.signal
    ).catch((err) => {
      if (err?.name === "AbortError") return;
      console.error("Generic stream failed, using fallback:", err);
      setGenericFallback(true);
      setGenericStream(FALLBACK_GENERIC);
    });

    const draftlyPromise = streamDraftly(
      rfpText,
      (c) => setDraftlyStream((p) => p + c),
      controller.signal
    ).catch((err) => {
      if (err?.name === "AbortError") return;
      console.error("Draftly stream failed, using fallback:", err);
      setDraftlyFallback(true);
      setDraftlyStream(FALLBACK_DRAFTLY);
    });

    try {
      await Promise.all([genericPromise, draftlyPromise]);
      setDone(true);
    } catch {
      // aborted — silently stop
    } finally {
      setRunning(false);
    }
  }, [running, rfpText]);

  return (
    <>
      {/* ── Scoped styles ── */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        @keyframes pulseIndigo {
          0%, 100% { box-shadow: 0 0 0 0 rgba(99,102,241,0.2); }
          50% { box-shadow: 0 0 24px 6px rgba(99,102,241,0.12); }
        }

        @keyframes meshFloat {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(10px, -20px) scale(1.02); }
          50% { transform: translate(-5px, 10px) scale(0.98); }
          75% { transform: translate(15px, 5px) scale(1.01); }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .demo-fade-up { animation: fadeUp 0.5s ease both; }
        .demo-fade-up-1 { animation: fadeUp 0.5s 0.08s ease both; }
        .demo-fade-up-2 { animation: fadeUp 0.5s 0.16s ease both; }
        .demo-fade-up-3 { animation: fadeUp 0.5s 0.24s ease both; }
        .demo-fade-up-4 { animation: fadeUp 0.5s 0.32s ease both; }

        /* Grain overlay - light variant */
        .demo-grain::after {
          content: '';
          position: fixed;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          z-index: 999;
          opacity: 0.018;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
        }

        /* Output scroll */
        .demo-output-scroll {
          scrollbar-width: thin;
          scrollbar-color: #CBD5E1 transparent;
        }
        .demo-output-scroll::-webkit-scrollbar { width: 3px; }
        .demo-output-scroll::-webkit-scrollbar-track { background: transparent; }
        .demo-output-scroll::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 2px; }

        /* Feature card hover */
        .demo-feature-card {
          transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
        }
        .demo-feature-card:hover {
          border-color: var(--vellum-border) !important;
          transform: translateY(-3px);
          box-shadow: 0 12px 40px rgba(11,15,26,0.08);
        }

        /* RFP chip */
        .demo-rfp-chip {
          transition: all 0.15s;
          cursor: pointer;
        }
        .demo-rfp-chip:hover {
          border-color: var(--indigo) !important;
          color: var(--indigo) !important;
          background: var(--indigo-light) !important;
        }
        .demo-rfp-chip.active {
          border-color: var(--indigo) !important;
          color: var(--indigo);
          background: var(--indigo-light);
        }

        /* Run button shimmer */
        .demo-btn-run {
          background: linear-gradient(135deg, var(--indigo), var(--indigo-hover));
          color: #fff;
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .demo-btn-run:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(99,102,241,0.3);
        }
        .demo-btn-run:active:not(:disabled) {
          transform: translateY(0);
        }
        .demo-btn-run::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .demo-btn-run:disabled {
          background: #E2E8F0;
          color: #94A3B8;
          cursor: not-allowed;
        }

        /* Stop button */
        .demo-btn-stop {
          background: transparent;
          border: 1px solid var(--coral);
          color: var(--coral);
          transition: background 0.15s;
        }
        .demo-btn-stop:hover {
          background: var(--coral-light);
        }

        /* Intel badge */
        .demo-intel-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          background: var(--indigo-light);
          border: 1px solid rgba(99,102,241,0.2);
          color: var(--indigo);
          padding: 4px 10px;
          border-radius: 20px;
        }

        /* Done glow */
        .demo-done-glow {
          animation: pulseIndigo 2s ease-in-out 3;
        }

        /* Tab underline */
        .demo-tab-active {
          position: relative;
          color: var(--indigo) !important;
        }
        .demo-tab-active::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0; right: 0;
          height: 2px;
          background: var(--indigo);
          border-radius: 1px;
        }

        /* Architecture node */
        .demo-arch-node {
          padding: 12px 18px;
          border: 1px solid var(--vellum-border);
          border-radius: 8px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--ink-secondary);
          background: var(--card-bg);
          transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
        }
        .demo-arch-node:hover {
          border-color: var(--indigo);
          color: var(--ink-primary);
          box-shadow: 0 4px 16px rgba(99,102,241,0.08);
        }

        .demo-mesh-bg {
          background:
            radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at 80% 20%, rgba(249,112,102,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at 50% 80%, rgba(16,185,129,0.04) 0%, transparent 50%),
            var(--vellum);
        }
      `}</style>

      <div className="demo-grain demo-mesh-bg" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="demo-fade-up" style={{
          borderBottom: "1px solid var(--vellum-border)",
          padding: "14px 32px",
          display: "grid",
          gridTemplateColumns: "1fr auto 1fr",
          alignItems: "center",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(247,245,239,0.85)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
            <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 700, letterSpacing: "-0.5px", color: "var(--ink-primary)" }}>
              Draftly
            </span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)", letterSpacing: "0.12em", textTransform: "uppercase" as const }}>
              LIVE DEMO
            </span>
          </div>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: "28px", justifyContent: "center" }}>
            {(["demo", "features", "architecture"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "demo-tab-active" : ""}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: activeTab === tab ? "var(--indigo)" : "var(--ink-muted)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase" as const,
                  padding: "4px 0",
                  transition: "color 0.15s",
                }}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* LionTown badge */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <div className="demo-intel-badge">
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--indigo)", display: "inline-block" }} />
              LionTown Marketing · 847 proposals
            </div>
          </div>
        </header>

        {/* ── DEMO TAB ────────────────────────────────────────────────────── */}
        {activeTab === "demo" && (
          <div style={{ display: "flex", flexDirection: "column", padding: "24px 32px", gap: "20px" }}>

            {/* RFP selector + edit */}
            <div className="demo-fade-up-1" style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.12em", color: "var(--ink-muted)", textTransform: "uppercase" as const }}>
                    Select RFP Brief
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {SAMPLE_RFPS.map((r, i) => (
                    <button
                      key={i}
                      className={`demo-rfp-chip ${selectedRfp === i && !isEditingRfp ? "active" : ""}`}
                      onClick={() => { setSelectedRfp(i); setIsEditingRfp(false); setCustomRfp(""); }}
                      style={{
                        fontFamily: "'Outfit', sans-serif",
                        fontSize: "14px",
                        fontWeight: 600,
                        background: "var(--card-bg)",
                        border: "1px solid var(--vellum-border)",
                        color: "var(--ink-secondary)",
                        padding: "12px 24px",
                        borderRadius: "30px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        boxShadow: selectedRfp === i && !isEditingRfp ? "0 4px 12px rgba(99,102,241,0.15)" : "none",
                      }}
                    >
                      {r.label}
                    </button>
                  ))}
                  <button
                    className={`demo-rfp-chip ${isEditingRfp ? "active" : ""}`}
                    onClick={() => setIsEditingRfp(!isEditingRfp)}
                    style={{
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "14px",
                      fontWeight: 600,
                      background: "var(--card-bg)",
                      border: "1px solid var(--vellum-border)",
                      color: "var(--ink-secondary)",
                      padding: "12px 24px",
                      borderRadius: "30px",
                    }}
                  >
                    ✎   Custom RFP
                  </button>
                </div>
              </div>
            </div>

            {/* Custom RFP textarea */}
            {isEditingRfp && (
              <div className="demo-fade-up" style={{ background: "var(--card-bg)", border: "1px solid var(--vellum-border)", borderRadius: "12px", padding: "18px", boxShadow: "var(--card-shadow)" }}>
                <label style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", letterSpacing: "0.1em", color: "var(--ink-muted)", marginBottom: "8px", textTransform: "uppercase" as const }}>
                  Custom RFP / Brief
                </label>
                <textarea
                  value={customRfp}
                  onChange={(e) => setCustomRfp(e.target.value)}
                  placeholder="Paste your RFP here…"
                  rows={5}
                  style={{
                    width: "100%",
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "var(--ink-primary)",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "12px",
                    lineHeight: 1.7,
                    resize: "vertical",
                  }}
                />
              </div>
            )}

            {/* RFP preview (collapsed) */}
            {!isEditingRfp && (
              <div style={{
                background: "var(--card-bg)",
                border: "1px solid var(--vellum-border)",
                borderRadius: "12px",
                padding: "14px 18px",
                borderLeft: "3px solid var(--indigo)",
                boxShadow: "var(--card-shadow)",
              }}>
                <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--ink-secondary)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {rfpText}
                </p>
              </div>
            )}

            {/* Split output panels */}
            <div className="demo-fade-up-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1, minHeight: "340px" }}>

              {/* Generic GPT panel */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--card-bg)",
                border: "1px solid rgba(249,112,102,0.3)",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "var(--card-shadow)",
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(249,112,102,0.15)",
                  background: "rgba(249,112,102,0.04)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, color: "var(--coral)" }}>Generic GPT 5</span>
                      {running && !genericFallback && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--coral)", opacity: 0.7 }}>
                          ● streaming
                        </span>
                      )}
                      {genericFallback && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", background: "rgba(249,112,102,0.1)", color: "var(--coral)", padding: "2px 8px", borderRadius: "10px" }}>
                          cached demo
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)", marginTop: "3px" }}>
                      No firm context · generic output
                    </p>
                  </div>
                  {genericWordCount > 0 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)" }}>
                      {genericWordCount}w
                    </span>
                  )}
                </div>
                <div
                  ref={genericRef}
                  className="demo-output-scroll"
                  style={{
                    flex: 1,
                    padding: "18px",
                    overflowY: "auto",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11.5px",
                    lineHeight: 1.8,
                    color: "var(--ink-muted)",
                  }}
                >
                  {genericStream ? (
                    <HighlightedOutput text={genericStream} isTyping={running} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.8 }}>
                        Generic output will appear here.<br />
                        <span style={{ opacity: 0.5 }}>Same RFP. No memory. No context.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Draftly panel */}
              <div
                className={done ? "demo-done-glow" : ""}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--card-bg)",
                  border: done ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(99,102,241,0.25)",
                  borderRadius: "12px",
                  overflow: "hidden",
                  transition: "border-color 0.4s",
                  boxShadow: "var(--card-shadow)",
                }}
              >
                <div style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(99,102,241,0.12)",
                  background: "rgba(99,102,241,0.03)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontFamily: "'Outfit', sans-serif", fontSize: "15px", fontWeight: 600, color: "var(--indigo)" }}>Draftly + Context-Mapper</span>
                      {running && !draftlyFallback && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--indigo)", opacity: 0.7 }}>
                          ● streaming
                        </span>
                      )}
                      {draftlyFallback && (
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", background: "rgba(99,102,241,0.1)", color: "var(--indigo)", padding: "2px 8px", borderRadius: "10px" }}>
                          cached demo
                        </span>
                      )}
                    </div>
                    <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)", marginTop: "3px" }}>
                      LionTown · 847 proposals · $4,500 anchor · 73% win rate
                    </p>
                  </div>
                  {draftlyWordCount > 0 && (
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--indigo)", opacity: 0.7 }}>
                      {draftlyWordCount}w
                    </span>
                  )}
                </div>
                <div
                  ref={draftlyRef}
                  className="demo-output-scroll"
                  style={{
                    flex: 1,
                    padding: "18px",
                    overflowY: "auto",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11.5px",
                    lineHeight: 1.8,
                    color: "var(--ink-primary)",
                  }}
                >
                  {draftlyStream ? (
                    <HighlightedOutput text={draftlyStream} isTyping={running} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--ink-muted)", textAlign: "center", lineHeight: 1.8 }}>
                        Context-aware output will appear here.<br />
                        <span style={{ opacity: 0.7, color: "var(--indigo)" }}>847 proposals of institutional memory.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom bar: run button + quote */}
            <div className="demo-fade-up-3" style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "12px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="demo-btn-run"
                  onClick={runDemo}
                  disabled={!rfpText.trim()}
                  style={{
                    flex: 1,
                    padding: "15px 24px",
                    border: "none",
                    borderRadius: "10px",
                    fontFamily: "'Outfit', sans-serif",
                    fontSize: "14px",
                    fontWeight: 600,
                    letterSpacing: "0.02em",
                    cursor: "pointer",
                  }}
                >
                  {running ? "Generating — same RFP, two very different results" : done ? "▶ Run Again" : "▶ Run Demo — Same RFP, Two Results"}
                </button>
                {running && (
                  <button
                    className="demo-btn-stop"
                    onClick={runDemo}
                    style={{
                      padding: "15px 20px",
                      borderRadius: "10px",
                      fontFamily: "'Outfit', sans-serif",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    ◼ Stop
                  </button>
                )}
              </div>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", textAlign: "center", fontSize: "10.5px", color: "var(--ink-muted)", lineHeight: 1.7, marginBottom: "0" }}>
                &ldquo;OpenAI will never fine-tune on LionTown&apos;s 847 proposals, $4,500 retainer anchor, or 73% Brightfield win rate. Draftly will.&rdquo;
              </p>
            </div>
          </div>
        )}

        {/* ── FEATURES TAB ─────────────────────────────────────────────────── */}
        {activeTab === "features" && (
          <div style={{ padding: "48px 32px 16px 32px", maxWidth: "960px", margin: "0 auto", width: "100%" }}>

            <div className="demo-fade-up" style={{ marginBottom: "48px" }}>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "42px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1px", marginBottom: "12px", color: "var(--ink-primary)" }}>
                What makes Draftly<br />
                <em style={{ color: "var(--indigo)", fontStyle: "italic" }}>impossible to replicate.</em>
              </h1>
              <p style={{ color: "var(--ink-secondary)", fontSize: "15px", lineHeight: 1.7, maxWidth: "540px" }}>
                Every proposal your firm has ever written becomes a competitive advantage. The moat grows with every deal — won or lost.
              </p>
            </div>

            <div className="demo-fade-up-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "48px" }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.id}
                  className="demo-feature-card"
                  style={{
                    padding: "28px",
                    background: "var(--card-bg)",
                    border: "1px solid var(--vellum-border)",
                    borderRadius: "12px",
                    animationDelay: `${i * 0.08}s`,
                    boxShadow: "var(--card-shadow)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div>
                      <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "20px", fontWeight: 600, marginBottom: "4px", color: "var(--ink-primary)" }}>{f.label}</h3>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: f.color === "indigo" ? "var(--indigo)" : "var(--jade)", letterSpacing: "0.08em" }}>
                        {f.sublabel}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "24px",
                        fontWeight: 500,
                        color: f.color === "indigo" ? "var(--indigo)" : "var(--jade)",
                        lineHeight: 1,
                      }}>
                        {f.stat}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "var(--ink-muted)", marginTop: "2px" }}>{f.statLabel}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--ink-secondary)", lineHeight: 1.7, fontFamily: "'DM Sans', sans-serif" }}>{f.description}</p>
                </div>
              ))}
            </div>

            {/* Tiers */}
            <div className="demo-fade-up-2">
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "24px", fontWeight: 600, marginBottom: "20px", letterSpacing: "-0.5px", color: "var(--ink-primary)" }}>Pricing</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { name: "Starter", price: "$99", period: "/mo", features: ["Proposal generation", "DOCX export", "Basic analytics"], highlight: false },
                  { name: "Professional", price: "$249", period: "/mo", features: ["Everything in Starter", "Context-Mapper (full)", "RAG pipeline", "HubSpot + Pipedrive"], highlight: true },
                  { name: "GTM Agent", price: "$399", period: "/mo", features: ["Everything in Pro", "AI outreach sequences", "Meeting signal extraction", "Phase-gated (≥50 CM users)"], highlight: false },
                ].map((tier) => (
                  <div key={tier.name} style={{
                    padding: "24px",
                    background: tier.highlight ? "var(--indigo-light)" : "var(--card-bg)",
                    border: `1px solid ${tier.highlight ? "rgba(99,102,241,0.3)" : "var(--vellum-border)"}`,
                    borderRadius: "12px",
                    position: "relative",
                    boxShadow: tier.highlight ? "0 4px 20px rgba(99,102,241,0.1)" : "var(--card-shadow)",
                  }}>
                    {tier.highlight && (
                      <div style={{
                        position: "absolute",
                        top: "-10px", left: "50%", transform: "translateX(-50%)",
                        background: "linear-gradient(135deg, var(--indigo), var(--indigo-hover))",
                        color: "#fff",
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "9px",
                        fontWeight: 600,
                        padding: "3px 12px",
                        borderRadius: "12px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase" as const,
                      }}>
                        Core Tier
                      </div>
                    )}
                    <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "18px", fontWeight: 600, marginBottom: "8px", color: "var(--ink-primary)" }}>{tier.name}</h3>
                    <div style={{ marginBottom: "16px" }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "28px", color: tier.highlight ? "var(--indigo)" : "var(--ink-primary)" }}>{tier.price}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", color: "var(--ink-muted)" }}>{tier.period}</span>
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px", padding: 0, margin: 0 }}>
                      {tier.features.map((f) => (
                        <li key={f} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--ink-secondary)", display: "flex", gap: "8px" }}>
                          <span style={{ color: tier.highlight ? "var(--indigo)" : "var(--jade)" }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ARCHITECTURE TAB ─────────────────────────────────────────────── */}
        {activeTab === "architecture" && (
          <div style={{ padding: "48px 32px 16px 32px", maxWidth: "960px", margin: "0 auto", width: "100%" }}>

            <div className="demo-fade-up" style={{ marginBottom: "48px" }}>
              <h1 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "42px", fontWeight: 700, lineHeight: 1.1, letterSpacing: "-1px", marginBottom: "12px", color: "var(--ink-primary)" }}>
                Technical<br />
                <em style={{ color: "var(--indigo)", fontStyle: "italic" }}>architecture.</em>
              </h1>
              <p style={{ color: "var(--ink-secondary)", fontSize: "15px", lineHeight: 1.7, maxWidth: "560px" }}>
                No third-party DBs. Swift Vapor + SQLite — fast, auditable, customer-isolated.
              </p>
            </div>

            {/* Stack diagram */}
            <div className="demo-fade-up-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px", marginBottom: "40px" }}>
              {[
                { layer: "Frontend", tech: "Next.js 16.1", note: "React 19 + Tailwind CSS 4.2" },
                { layer: "Backend", tech: "Swift Vapor 4", note: "PostgreSQL via Fluent" },
                { layer: "Local Storage", tech: "Local BLOB store", note: "1024-dim · cosine similarity" },
                { layer: "Generation", tech: "Claude 4.5 Haiku", note: "Anthropic — primary proposal engine" },
                { layer: "Embeddings", tech: "OpenAI text-embedding-3-small", note: "text-embedding-3-small (1536-dim)" },
                { layer: "Hosting", tech: "DigitalOcean", note: "App Platform" },
                { layer: "Auth", tech: "JWT HS256", note: "Vapor/jwt-kit" },
                { layer: "Payments", tech: "Stripe", note: "Checkout Sessions + Portal" }
              ].map((item) => (
                <div key={item.layer} className="demo-arch-node">
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", letterSpacing: "0.1em", color: "var(--indigo)", textTransform: "uppercase" as const, marginBottom: "4px" }}>
                    {item.layer}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--ink-primary)", marginBottom: "2px", fontFamily: "'Outfit', sans-serif", fontWeight: 500 }}>{item.tech}</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)" }}>{item.note}</div>
                </div>
              ))}
            </div>

            {/* Architecture rules */}
            <div className="demo-fade-up-2" style={{ marginBottom: "40px" }}>
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 600, marginBottom: "16px", letterSpacing: "-0.5px", color: "var(--ink-primary)" }}>
                Invariants — never broken
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  ["Customer isolation", "Every SQL and vector query filters customer_id. Zero cross-customer data leakage."],
                  ["Claude for generation only", "OpenAI handles embeddings. Claude handles generation. Never swapped."],
                  ["Async file processing", "All ingest runs in Task.detached. HTTP response never blocked."],
                  ["DigitalOcean Hosted", "Running securely on DigitalOcean App Platform. Predictable performance."],
                  ["30-day soft-delete", "GDPR-compliant export window before hard deletion."],
                ].map(([rule, desc], i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: "16px",
                    padding: "14px 18px",
                    background: "var(--card-bg)",
                    border: "1px solid var(--vellum-border)",
                    borderRadius: "8px",
                    borderLeft: "3px solid var(--indigo)",
                    boxShadow: "var(--card-shadow)",
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--indigo)", fontWeight: 500 }}>{rule}</span>
                    <span style={{ fontSize: "12px", color: "var(--ink-secondary)", lineHeight: 1.6, fontFamily: "'DM Sans', sans-serif" }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Endpoints */}
            <div className="demo-fade-up-3">
              <h2 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "22px", fontWeight: 600, marginBottom: "16px", letterSpacing: "-0.5px", color: "var(--ink-primary)" }}>Key endpoints</h2>
              <div style={{
                background: "var(--card-bg)",
                border: "1px solid var(--vellum-border)",
                borderRadius: "12px",
                overflow: "hidden",
                boxShadow: "var(--card-shadow)",
              }}>
                {(() => {
                  const endpoints = [
                    ["POST", "https://api.draftly.biz/auth/register", "Create customer + JWT"],
                    ["POST", "https://api.draftly.biz/proposals/generate", "RAG + Claude (Professional+)"],
                    ["GET", "https://api.draftly.biz/proposals/:id/export-docx", "Download .docx"],
                    ["POST", "https://api.draftly.biz/ingest/proposal-file", "Async PDF/DOCX embed"],
                    ["POST", "https://api.draftly.biz/ingest/pricing-csv", "Async CSV pricing embed"],
                    ["GET", "https://api.draftly.biz/context-mapper/switching-cost", "Moat Meter & lock-in analysis"],
                    ["POST", "https://api.draftly.biz/demo/draftly", "Streaming context generation"],
                    ["POST", "https://api.draftly.biz/gtm/outreach-sequence", "GTM Agent personalized sequences"],
                    ["POST", "https://api.draftly.biz/crm/hubspot/log-deal", "Bidirectional pipeline logging"],
                    ["GET", "https://api.draftly.biz/analytics/unit-economics", "ROI & phase-gate tracking"],
                    ["POST", "https://api.draftly.biz/churn/detect", "Churn signal identification"],
                    ["GET", "https://api.draftly.biz/export/full", "ZIP GDPR data export"],
                  ];
                  return endpoints.map(([method, path, note], i) => (
                    <div key={i} style={{
                      display: "grid",
                      gridTemplateColumns: "56px max-content 1fr",
                      gap: "16px",
                      padding: "12px 18px",
                      borderBottom: i < endpoints.length - 1 ? "1px solid var(--vellum-border)" : "none",
                      alignItems: "center",
                    }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "10px",
                      fontWeight: 500,
                      color: method === "GET" ? "var(--jade)" : "var(--indigo)",
                      letterSpacing: "0.06em",
                    }}>
                      {method}
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "var(--ink-primary)" }}>{path}</span>
                    <span style={{ fontSize: "12px", color: "var(--ink-muted)", fontFamily: "'DM Sans', sans-serif" }}>{note}</span>
                  </div>
                ))})()}
              </div>
            </div>
          </div>
        )}

        {/* ── Global CTA ─────────────────────────────────────────────────── */}
        <div style={{
          padding: "8px 32px 32px 32px",
          textAlign: "center",
        }}>
          <h3 style={{ fontFamily: "'Outfit', sans-serif", fontSize: "24px", fontWeight: 700, marginBottom: "8px", color: "var(--ink-primary)" }}>
            Ready to try it yourself?
          </h3>
          <p style={{ color: "var(--ink-secondary)", fontSize: "14px", marginBottom: "20px" }}>
            Join 200+ firms using Draftly to win more deals with less work.
          </p>
          <a
            href="/signup"
            style={{
              display: "inline-block",
              padding: "12px 32px",
              background: "var(--indigo)",
              color: "white",
              borderRadius: "8px",
              fontFamily: "'Outfit', sans-serif",
              fontSize: "14px",
              fontWeight: 600,
              textDecoration: "none",
              transition: "transform 0.15s, box-shadow 0.15s",
              boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = "translateY(-1px)";
              e.currentTarget.style.boxShadow = "0 6px 16px rgba(99,102,241,0.4)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(99,102,241,0.3)";
            }}
          >
            Create Your Free Account →
          </a>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: "1px solid var(--vellum-border)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--card-bg)",
          marginTop: "auto"
        }}>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)" }}>
            Draftly © 2026 · Demo Mode
          </span>
          <div style={{ display: "flex", gap: "20px" }}>
            <a href="/login" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--indigo)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-muted)")}
            >
              Sign in →
            </a>
            <a href="/dashboard" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", color: "var(--ink-muted)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--indigo)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--ink-muted)")}
            >
              Dashboard →
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
