"use client";

/**
 * Draftly Live Demo — Editorial / Intelligence Aesthetic
 * DM Serif Display + JetBrains Mono + Instrument Sans
 * Split-screen: Generic GPT vs Draftly Context-Mapper
 */
import { useState, useRef, useEffect, useCallback } from "react";

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

// ─── Feature cards data ─────────────────────────────────────────────────────

const FEATURES = [
  {
    id: "context-mapper",
    label: "Context-Mapper",
    sublabel: "847 proposals indexed",
    description: "Every win, loss, and pricing anchor extracted into a private knowledge graph. Grows smarter with every proposal.",
    stat: "73%",
    statLabel: "win rate (Brightfield)",
    color: "amber",
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
    color: "amber",
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

async function streamGenericGPT(
  rfp: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch("/api/demo/generic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp }),
    signal,
  });
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}

async function streamDraftly(
  rfp: string,
  onChunk: (text: string) => void,
  signal: AbortSignal
): Promise<void> {
  const res = await fetch("/api/demo/draftly", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfp_text: rfp, customer_id: LIONTOWN_DEMO_CUSTOMER_ID }),
    signal,
  });
  const reader = res.body?.getReader();
  if (!reader) return;
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value));
  }
}

// ─── Typewriter cursor component ─────────────────────────────────────────────

function TypewriterCursor({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-block w-[2px] h-[1em] ml-[1px] align-middle ${
        active ? "animate-[blink_0.7s_step-end_infinite]" : "opacity-0"
      }`}
      style={{ background: "currentColor" }}
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
  const parts = text.split(/(\s+)/);
  return (
    <span>
      {parts.map((part, i) => {
        const isKeyword = DRAFTLY_KEYWORDS.some((kw) =>
          part.toLowerCase().includes(kw.toLowerCase())
        );
        if (isKeyword) {
          return (
            <mark
              key={i}
              className="bg-transparent text-amber-300 font-semibold not-italic"
              style={{ textShadow: "0 0 12px rgba(232,197,71,0.4)" }}
            >
              {part}
            </mark>
          );
        }
        return <span key={i}>{part}</span>;
      })}
      <TypewriterCursor active={isTyping} />
    </span>
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

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await Promise.all([
        streamGenericGPT(rfpText, (c) => setGenericStream((p) => p + c), controller.signal),
        streamDraftly(rfpText, (c) => setDraftlyStream((p) => p + c), controller.signal),
      ]);
      setDone(true);
    } catch {
      // aborted or error — silently stop
    } finally {
      setRunning(false);
    }
  }, [running, rfpText]);

  return (
    <>
      {/* ── Global styles injected via style tag ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@300;400;500&family=Instrument+Sans:wght@400;500;600&display=swap');

        :root {
          --ink: #0A0A0F;
          --ink-1: #111118;
          --ink-2: #1A1A24;
          --ink-3: #242432;
          --bone: #F0EDE6;
          --bone-dim: #9B9790;
          --bone-faint: #3A3A48;
          --amber: #E8C547;
          --amber-dim: rgba(232,197,71,0.15);
          --amber-glow: rgba(232,197,71,0.08);
          --red-dim: #C44D4D;
          --red-faint: rgba(196,77,77,0.12);
          --jade: #4EC994;
          --jade-dim: rgba(78,201,148,0.15);
          --border: rgba(240,237,230,0.08);
          --border-strong: rgba(240,237,230,0.16);
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          background: var(--ink);
          color: var(--bone);
          font-family: 'Instrument Sans', sans-serif;
          -webkit-font-smoothing: antialiased;
        }

        .serif { font-family: 'DM Serif Display', serif; }
        .mono { font-family: 'JetBrains Mono', monospace; }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        @keyframes grain {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-2%, -3%); }
          20% { transform: translate(3%, 2%); }
          30% { transform: translate(-1%, 4%); }
          40% { transform: translate(4%, -1%); }
          50% { transform: translate(-3%, 2%); }
          60% { transform: translate(2%, 3%); }
          70% { transform: translate(-4%, -2%); }
          80% { transform: translate(3%, -3%); }
          90% { transform: translate(-2%, 4%); }
        }

        @keyframes scanline {
          0% { top: -10%; }
          100% { top: 110%; }
        }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes pulseAmber {
          0%, 100% { box-shadow: 0 0 0 0 rgba(232,197,71,0.3); }
          50% { box-shadow: 0 0 20px 4px rgba(232,197,71,0.15); }
        }

        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }

        .fade-up { animation: fadeUp 0.5s ease both; }
        .fade-up-1 { animation: fadeUp 0.5s 0.1s ease both; }
        .fade-up-2 { animation: fadeUp 0.5s 0.2s ease both; }
        .fade-up-3 { animation: fadeUp 0.5s 0.3s ease both; }
        .fade-up-4 { animation: fadeUp 0.5s 0.4s ease both; }

        /* Grain overlay */
        .grain::after {
          content: '';
          position: fixed;
          inset: -50%;
          width: 200%;
          height: 200%;
          pointer-events: none;
          z-index: 999;
          opacity: 0.035;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-size: 200px 200px;
          animation: grain 8s steps(10) infinite;
        }

        /* Draftly panel scanline */
        .scanline-panel {
          position: relative;
          overflow: hidden;
        }
        .scanline-panel::before {
          content: '';
          position: absolute;
          left: 0; right: 0;
          height: 40px;
          background: linear-gradient(to bottom, transparent, rgba(232,197,71,0.04), transparent);
          animation: scanline 4s linear infinite;
          pointer-events: none;
          z-index: 10;
        }

        /* Tab underline */
        .tab-active {
          position: relative;
          color: var(--bone);
        }
        .tab-active::after {
          content: '';
          position: absolute;
          bottom: -2px; left: 0; right: 0;
          height: 1px;
          background: var(--amber);
        }

        /* Output scroll */
        .output-scroll {
          scrollbar-width: thin;
          scrollbar-color: var(--bone-faint) transparent;
        }
        .output-scroll::-webkit-scrollbar { width: 3px; }
        .output-scroll::-webkit-scrollbar-track { background: transparent; }
        .output-scroll::-webkit-scrollbar-thumb { background: var(--bone-faint); border-radius: 2px; }

        /* Feature card hover */
        .feature-card {
          transition: border-color 0.2s, transform 0.2s;
        }
        .feature-card:hover {
          border-color: var(--border-strong) !important;
          transform: translateY(-2px);
        }

        /* RFP chip */
        .rfp-chip {
          transition: all 0.15s;
          cursor: pointer;
        }
        .rfp-chip:hover {
          border-color: rgba(232,197,71,0.4) !important;
          color: var(--amber) !important;
        }
        .rfp-chip.active {
          border-color: var(--amber) !important;
          color: var(--amber);
          background: var(--amber-glow);
        }

        /* Run button shimmer */
        .btn-run {
          background: var(--amber);
          color: var(--ink);
          position: relative;
          overflow: hidden;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .btn-run:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 32px rgba(232,197,71,0.3);
        }
        .btn-run:active:not(:disabled) {
          transform: translateY(0);
        }
        .btn-run::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%);
          background-size: 200% auto;
          animation: shimmer 3s linear infinite;
        }
        .btn-run:disabled {
          background: var(--ink-3);
          color: var(--bone-faint);
          cursor: not-allowed;
        }

        /* Stop button */
        .btn-stop {
          background: transparent;
          border: 1px solid var(--red-dim);
          color: var(--red-dim);
          transition: background 0.15s;
        }
        .btn-stop:hover {
          background: var(--red-faint);
        }

        /* Intel badge */
        .intel-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-family: 'JetBrains Mono', monospace;
          background: var(--amber-dim);
          border: 1px solid rgba(232,197,71,0.25);
          color: var(--amber);
          padding: 3px 8px;
          border-radius: 2px;
        }

        /* Architecture node */
        .arch-node {
          padding: 10px 16px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-size: 12px;
          font-family: 'JetBrains Mono', monospace;
          color: var(--bone-dim);
          background: var(--ink-1);
          transition: border-color 0.15s, color 0.15s;
        }
        .arch-node:hover {
          border-color: var(--amber);
          color: var(--bone);
        }

        /* Done glow on Draftly panel */
        .done-glow {
          animation: pulseAmber 2s ease-in-out 3;
        }
      `}</style>

      <div className="grain min-h-screen flex flex-col" style={{ background: "var(--ink)" }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <header className="fade-up" style={{
          borderBottom: "1px solid var(--border)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 50,
          background: "rgba(10,10,15,0.92)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "16px" }}>
            <span className="serif" style={{ fontSize: "22px", letterSpacing: "-0.5px", color: "var(--bone)" }}>
              Draftly
            </span>
            <span className="mono" style={{ fontSize: "11px", color: "var(--bone-faint)", letterSpacing: "0.08em" }}>
              LIVE DEMO
            </span>
          </div>

          {/* Tabs */}
          <nav style={{ display: "flex", gap: "28px" }}>
            {(["demo", "features", "architecture"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={activeTab === tab ? "tab-active" : ""}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "'Instrument Sans', sans-serif",
                  fontSize: "13px",
                  fontWeight: 500,
                  color: activeTab === tab ? "var(--bone)" : "var(--bone-faint)",
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                  padding: "4px 0",
                  transition: "color 0.15s",
                }}
              >
                {tab}
              </button>
            ))}
          </nav>

          {/* LionTown badge */}
          <div className="intel-badge">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--amber)", display: "inline-block" }} />
            LionTown Marketing · 847 proposals
          </div>
        </header>

        {/* ── DEMO TAB ────────────────────────────────────────────────────── */}
        {activeTab === "demo" && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px 32px", gap: "20px" }}>

            {/* RFP selector + edit */}
            <div className="fade-up-1" style={{ display: "flex", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                  <span className="mono" style={{ fontSize: "10px", letterSpacing: "0.12em", color: "var(--bone-faint)", textTransform: "uppercase" }}>
                    Select RFP Brief
                  </span>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  {SAMPLE_RFPS.map((r, i) => (
                    <button
                      key={i}
                      className={`rfp-chip ${selectedRfp === i && !isEditingRfp ? "active" : ""}`}
                      onClick={() => { setSelectedRfp(i); setIsEditingRfp(false); setCustomRfp(""); }}
                      style={{
                        fontFamily: "'Instrument Sans', sans-serif",
                        fontSize: "12px",
                        fontWeight: 500,
                        background: "var(--ink-1)",
                        border: "1px solid var(--border)",
                        color: "var(--bone-dim)",
                        padding: "6px 14px",
                        borderRadius: "2px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span style={{ opacity: 0.6 }}>{r.icon}</span>
                      {r.label}
                    </button>
                  ))}
                  <button
                    className={`rfp-chip ${isEditingRfp ? "active" : ""}`}
                    onClick={() => setIsEditingRfp(!isEditingRfp)}
                    style={{
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: "12px",
                      fontWeight: 500,
                      background: "var(--ink-1)",
                      border: "1px solid var(--border)",
                      color: "var(--bone-dim)",
                      padding: "6px 14px",
                      borderRadius: "2px",
                    }}
                  >
                    ✎ Custom
                  </button>
                </div>
              </div>
            </div>

            {/* Custom RFP textarea */}
            {isEditingRfp && (
              <div className="fade-up" style={{ background: "var(--ink-1)", border: "1px solid var(--border-strong)", borderRadius: "4px", padding: "16px" }}>
                <label className="mono" style={{ display: "block", fontSize: "10px", letterSpacing: "0.1em", color: "var(--bone-faint)", marginBottom: "8px", textTransform: "uppercase" }}>
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
                    color: "var(--bone)",
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
                background: "var(--ink-1)",
                border: "1px solid var(--border)",
                borderRadius: "4px",
                padding: "14px 18px",
                borderLeft: "2px solid var(--bone-faint)",
              }}>
                <p className="mono" style={{ fontSize: "11px", color: "var(--bone-dim)", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
                  {rfpText.slice(0, 200)}{rfpText.length > 200 ? "…" : ""}
                </p>
              </div>
            )}

            {/* Split output panels */}
            <div className="fade-up-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", flex: 1, minHeight: "340px" }}>

              {/* Generic GPT panel */}
              <div style={{
                display: "flex",
                flexDirection: "column",
                background: "var(--ink-1)",
                border: "1px solid rgba(196,77,77,0.25)",
                borderRadius: "6px",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(196,77,77,0.15)",
                  background: "rgba(196,77,77,0.06)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="serif" style={{ fontSize: "15px", color: "#E87171" }}>Generic GPT-4o</span>
                      {running && (
                        <span className="mono" style={{ fontSize: "10px", color: "#E87171", opacity: 0.7 }}>
                          ● streaming
                        </span>
                      )}
                    </div>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)", marginTop: "3px" }}>
                      No firm context · generic output
                    </p>
                  </div>
                  {genericWordCount > 0 && (
                    <span className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)" }}>
                      {genericWordCount}w
                    </span>
                  )}
                </div>
                <div
                  ref={genericRef}
                  className="output-scroll"
                  style={{
                    flex: 1,
                    padding: "18px",
                    overflowY: "auto",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11.5px",
                    lineHeight: 1.8,
                    color: "rgba(240,237,230,0.5)",
                  }}
                >
                  {genericStream ? (
                    <span>
                      {genericStream}
                      <TypewriterCursor active={running} />
                    </span>
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p className="mono" style={{ fontSize: "11px", color: "var(--bone-faint)", textAlign: "center", lineHeight: 1.8 }}>
                        Generic output will appear here.<br />
                        <span style={{ opacity: 0.5 }}>Same RFP. No memory. No context.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Draftly panel */}
              <div
                className={`scanline-panel ${done ? "done-glow" : ""}`}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  background: "var(--ink-1)",
                  border: done ? "1px solid rgba(232,197,71,0.5)" : "1px solid rgba(232,197,71,0.2)",
                  borderRadius: "6px",
                  overflow: "hidden",
                  transition: "border-color 0.4s",
                }}
              >
                <div style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid rgba(232,197,71,0.12)",
                  background: "rgba(232,197,71,0.05)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="serif" style={{ fontSize: "15px", color: "var(--amber)" }}>Draftly + Context-Mapper</span>
                      {running && (
                        <span className="mono" style={{ fontSize: "10px", color: "var(--amber)", opacity: 0.7 }}>
                          ● streaming
                        </span>
                      )}
                    </div>
                    <p className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)", marginTop: "3px" }}>
                      LionTown · 847 proposals · $4,500 anchor · 73% win rate
                    </p>
                  </div>
                  {draftlyWordCount > 0 && (
                    <span className="mono" style={{ fontSize: "10px", color: "var(--amber)", opacity: 0.7 }}>
                      {draftlyWordCount}w
                    </span>
                  )}
                </div>
                <div
                  ref={draftlyRef}
                  className="output-scroll"
                  style={{
                    flex: 1,
                    padding: "18px",
                    overflowY: "auto",
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "11.5px",
                    lineHeight: 1.8,
                    color: "var(--bone)",
                  }}
                >
                  {draftlyStream ? (
                    <HighlightedOutput text={draftlyStream} isTyping={running} />
                  ) : (
                    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <p className="mono" style={{ fontSize: "11px", color: "var(--bone-faint)", textAlign: "center", lineHeight: 1.8 }}>
                        Context-aware output will appear here.<br />
                        <span style={{ opacity: 0.5, color: "var(--amber)" }}>847 proposals of institutional memory.</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bottom bar: run button + quote */}
            <div className="fade-up-3" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  className="btn-run"
                  onClick={runDemo}
                  disabled={!rfpText.trim()}
                  style={{
                    flex: 1,
                    padding: "15px 24px",
                    border: "none",
                    borderRadius: "4px",
                    fontFamily: "'Instrument Sans', sans-serif",
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
                    className="btn-stop"
                    onClick={runDemo}
                    style={{
                      padding: "15px 20px",
                      border: "none",
                      borderRadius: "4px",
                      fontFamily: "'Instrument Sans', sans-serif",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    ◼ Stop
                  </button>
                )}
              </div>
              <p className="mono" style={{ textAlign: "center", fontSize: "10.5px", color: "var(--bone-faint)", lineHeight: 1.7 }}>
                "OpenAI will never fine-tune on LionTown's 847 proposals, $4,500 retainer anchor, or 73% Brightfield win rate. Draftly will."
              </p>
            </div>
          </div>
        )}

        {/* ── FEATURES TAB ─────────────────────────────────────────────────── */}
        {activeTab === "features" && (
          <div style={{ flex: 1, padding: "48px 32px", maxWidth: "960px", margin: "0 auto", width: "100%" }}>

            <div className="fade-up" style={{ marginBottom: "48px" }}>
              <h1 className="serif" style={{ fontSize: "42px", lineHeight: 1.1, letterSpacing: "-1px", marginBottom: "12px" }}>
                What makes Draftly<br />
                <em style={{ color: "var(--amber)" }}>impossible to replicate.</em>
              </h1>
              <p style={{ color: "var(--bone-dim)", fontSize: "15px", lineHeight: 1.7, maxWidth: "540px" }}>
                Every proposal your firm has ever written becomes a competitive advantage. The moat grows with every deal — won or lost.
              </p>
            </div>

            <div className="fade-up-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "48px" }}>
              {FEATURES.map((f, i) => (
                <div
                  key={f.id}
                  className="feature-card"
                  style={{
                    padding: "28px",
                    background: "var(--ink-1)",
                    border: "1px solid var(--border)",
                    borderRadius: "6px",
                    animationDelay: `${i * 0.08}s`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "16px" }}>
                    <div>
                      <h3 className="serif" style={{ fontSize: "20px", marginBottom: "4px" }}>{f.label}</h3>
                      <span className="mono" style={{ fontSize: "10px", color: f.color === "amber" ? "var(--amber)" : "var(--jade)", letterSpacing: "0.08em" }}>
                        {f.sublabel}
                      </span>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="mono" style={{
                        fontSize: "24px",
                        fontWeight: 500,
                        color: f.color === "amber" ? "var(--amber)" : "var(--jade)",
                        lineHeight: 1,
                      }}>
                        {f.stat}
                      </div>
                      <div className="mono" style={{ fontSize: "9px", color: "var(--bone-faint)", marginTop: "2px" }}>{f.statLabel}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: "13px", color: "var(--bone-dim)", lineHeight: 1.7 }}>{f.description}</p>
                </div>
              ))}
            </div>

            {/* Tiers */}
            <div className="fade-up-2">
              <h2 className="serif" style={{ fontSize: "24px", marginBottom: "20px", letterSpacing: "-0.5px" }}>Pricing</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                {[
                  { name: "Starter", price: "$99", period: "/mo", features: ["Proposal generation", "DOCX export", "Basic analytics"], highlight: false },
                  { name: "Professional", price: "$249", period: "/mo", features: ["Everything in Starter", "Context-Mapper (full)", "RAG pipeline", "HubSpot + Pipedrive"], highlight: true },
                  { name: "GTM Agent", price: "$399", period: "/mo", features: ["Everything in Pro", "AI outreach sequences", "Meeting signal extraction", "Phase-gated (≥50 CM users)"], highlight: false },
                ].map((tier) => (
                  <div key={tier.name} style={{
                    padding: "24px",
                    background: tier.highlight ? "var(--amber-dim)" : "var(--ink-1)",
                    border: `1px solid ${tier.highlight ? "rgba(232,197,71,0.3)" : "var(--border)"}`,
                    borderRadius: "6px",
                    position: "relative",
                  }}>
                    {tier.highlight && (
                      <div className="mono" style={{
                        position: "absolute",
                        top: "-10px", left: "50%", transform: "translateX(-50%)",
                        background: "var(--amber)",
                        color: "var(--ink)",
                        fontSize: "9px",
                        fontWeight: 600,
                        padding: "2px 10px",
                        borderRadius: "2px",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                      }}>
                        Core Tier
                      </div>
                    )}
                    <h3 className="serif" style={{ fontSize: "18px", marginBottom: "8px" }}>{tier.name}</h3>
                    <div style={{ marginBottom: "16px" }}>
                      <span className="mono" style={{ fontSize: "28px", color: tier.highlight ? "var(--amber)" : "var(--bone)" }}>{tier.price}</span>
                      <span className="mono" style={{ fontSize: "12px", color: "var(--bone-faint)" }}>{tier.period}</span>
                    </div>
                    <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {tier.features.map((f) => (
                        <li key={f} className="mono" style={{ fontSize: "11px", color: "var(--bone-dim)", display: "flex", gap: "8px" }}>
                          <span style={{ color: tier.highlight ? "var(--amber)" : "var(--jade)" }}>✓</span>
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
          <div style={{ flex: 1, padding: "48px 32px", maxWidth: "960px", margin: "0 auto", width: "100%" }}>

            <div className="fade-up" style={{ marginBottom: "48px" }}>
              <h1 className="serif" style={{ fontSize: "42px", lineHeight: 1.1, letterSpacing: "-1px", marginBottom: "12px" }}>
                Technical<br />
                <em style={{ color: "var(--amber)" }}>architecture.</em>
              </h1>
              <p style={{ color: "var(--bone-dim)", fontSize: "15px", lineHeight: 1.7, maxWidth: "560px" }}>
                No third-party vector DBs. No Supabase. No Python. Swift Vapor + SQLite — fast, auditable, customer-isolated.
              </p>
            </div>

            {/* Stack diagram */}
            <div className="fade-up-1" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginBottom: "40px" }}>
              {[
                { layer: "Frontend", tech: "Next.js 14", note: "Tailwind CSS + shadcn/ui" },
                { layer: "Backend", tech: "Swift Vapor 4", note: "SQLite via Fluent ORM" },
                { layer: "Vectors", tech: "SIMD BLOB store", note: "1024-dim · cosine similarity" },
                { layer: "Generation", tech: "Claude Sonnet 4.6", note: "Anthropic — never swapped" },
                { layer: "Embeddings", tech: "OpenAI ada-3-large", note: "text-embedding-3-large" },
                { layer: "Cache", tech: "Upstash Redis", note: "72-hr LLM response hedge" },
                { layer: "Auth", tech: "JWT HS256", note: "Vapor/jwt-kit" },
                { layer: "Payments", tech: "Stripe", note: "Checkout Sessions" },
                { layer: "CRM", tech: "HubSpot + Pipedrive", note: "OAuth + API key" },
              ].map((item) => (
                <div key={item.layer} className="arch-node">
                  <div className="mono" style={{ fontSize: "9px", letterSpacing: "0.1em", color: "var(--amber)", textTransform: "uppercase", marginBottom: "4px" }}>
                    {item.layer}
                  </div>
                  <div style={{ fontSize: "13px", color: "var(--bone)", marginBottom: "2px" }}>{item.tech}</div>
                  <div className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)" }}>{item.note}</div>
                </div>
              ))}
            </div>

            {/* Architecture rules */}
            <div className="fade-up-2" style={{ marginBottom: "40px" }}>
              <h2 className="serif" style={{ fontSize: "22px", marginBottom: "16px", letterSpacing: "-0.5px" }}>
                Invariants — never broken
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  ["Customer isolation", "Every SQL and vector query filters customer_id. Zero cross-customer data leakage."],
                  ["Claude for generation only", "OpenAI handles embeddings. Claude handles generation. Never swapped."],
                  ["Async file processing", "All ingest runs in Task.detached. HTTP response never blocked."],
                  ["72-hr Redis cache", "All LLM responses cached. AI provider outage = zero customer impact."],
                  ["30-day soft-delete", "GDPR-compliant export window before hard deletion."],
                ].map(([rule, desc], i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "220px 1fr",
                    gap: "16px",
                    padding: "14px 18px",
                    background: "var(--ink-1)",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    borderLeft: "2px solid var(--amber)",
                  }}>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--amber)" }}>{rule}</span>
                    <span style={{ fontSize: "12px", color: "var(--bone-dim)", lineHeight: 1.6 }}>{desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Endpoints */}
            <div className="fade-up-3">
              <h2 className="serif" style={{ fontSize: "22px", marginBottom: "16px", letterSpacing: "-0.5px" }}>Key endpoints</h2>
              <div style={{
                background: "var(--ink-1)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                overflow: "hidden",
              }}>
                {[
                  ["POST", "/auth/register", "Create customer + JWT"],
                  ["POST", "/proposals/generate", "RAG + Claude (Professional+)"],
                  ["GET", "/proposals/:id/export-docx", "Download .docx"],
                  ["POST", "/ingest/proposal-file", "Async PDF/DOCX embed"],
                  ["POST", "/ingest/pricing-csv", "Async CSV pricing embed"],
                  ["POST", "/gtm/meeting-signals", "Extract deal signals (GTM tier)"],
                  ["GET", "/export/full", "ZIP GDPR data export"],
                  ["POST", "/crm/pipedrive/sync-deal", "Sync proposal → Pipedrive deal"],
                ].map(([method, path, note], i) => (
                  <div key={i} style={{
                    display: "grid",
                    gridTemplateColumns: "56px 260px 1fr",
                    gap: "16px",
                    padding: "11px 18px",
                    borderBottom: i < 7 ? "1px solid var(--border)" : "none",
                    alignItems: "center",
                  }}>
                    <span className="mono" style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      color: method === "GET" ? "var(--jade)" : "var(--amber)",
                      letterSpacing: "0.06em",
                    }}>
                      {method}
                    </span>
                    <span className="mono" style={{ fontSize: "11px", color: "var(--bone)" }}>{path}</span>
                    <span style={{ fontSize: "12px", color: "var(--bone-faint)" }}>{note}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <footer style={{
          borderTop: "1px solid var(--border)",
          padding: "16px 32px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <span className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)" }}>
            Draftly © 2026 · Demo Mode
          </span>
          <div style={{ display: "flex", gap: "20px" }}>
            <a href="/login" className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--amber)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--bone-faint)")}
            >
              Sign in →
            </a>
            <a href="/dashboard" className="mono" style={{ fontSize: "10px", color: "var(--bone-faint)", textDecoration: "none", transition: "color 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "var(--amber)")}
              onMouseLeave={e => (e.currentTarget.style.color = "var(--bone-faint)")}
            >
              Dashboard →
            </a>
          </div>
        </footer>
      </div>
    </>
  );
}
