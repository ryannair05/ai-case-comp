"use client";

/**
 * /proposals/new — Proposal generation workspace.
 * Aesthetic: Creative studio — dark with warm amber accent.
 * Like a craftsman's workbench for proposal writing.
 * Typography: Fraunces (display) + Crimson Pro (body/inputs) + JetBrains Mono (data).
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
  "Looking for a brand refresh including new logo, website copy, and one-pager. We\u0027re a 12-person accounting firm.",
  "We need help with our annual tax planning strategy and implementing a proactive approach for next fiscal year.",
];

interface ProposalSection {
  heading: string;
  body: string;
}

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

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: "flex", gap: "2px" }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontSize: "22px",
            color: star <= (hover || value) ? "#F59E0B" : "rgba(255,255,255,0.08)",
            transition: "transform 0.15s, color 0.15s",
            transform: star <= (hover || value) ? "scale(1.1)" : "scale(1)",
          }}
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

  const [proposalsIndexed, setProposalsIndexed] = useState<number | null>(null);
  const COLD_START_THRESHOLD = 15;

  const [starRating, setStarRating] = useState(0);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);
  const [ratingLoading, setRatingLoading] = useState(false);

  const [sectionMode, setSectionMode] = useState(false);
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [editingSection, setEditingSection] = useState<number | null>(null);

  const isProfessional = hasProfessionalAccess(user?.tier);

  useEffect(() => {
    if (!isProfessional) return;
    contextMapperApi.status().then((status) => {
      setProposalsIndexed(status?.proposals_indexed ?? 0);
    }).catch(() => { });
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
    <>
      <style>{`
        @keyframes propReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes propSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes propPulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
        .prop-input {
          width: 100%;
          padding: 14px 16px;
          border: 1.5px solid rgba(255,255,255,0.08);
          border-radius: 10px;
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 16px;
          color: #F5F0E8;
          background: rgba(255,255,255,0.03);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
          line-height: 1.6;
        }
        .prop-input::placeholder {
          color: rgba(245,240,232,0.2);
          font-style: italic;
        }
        .prop-input:focus {
          border-color: rgba(245,158,11,0.4);
          box-shadow: 0 0 0 3px rgba(245,158,11,0.06);
        }
        .prop-textarea { resize: none; }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#13110E",
        backgroundImage: `
          radial-gradient(ellipse at 20% 0%, rgba(245,158,11,0.04) 0%, transparent 50%),
          radial-gradient(ellipse at 80% 100%, rgba(120,113,108,0.03) 0%, transparent 50%)
        `,
        fontFamily: "'Crimson Pro', Georgia, serif",
      }}>
        <AppNav />

        <div style={{ maxWidth: "780px", margin: "0 auto", padding: "40px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: "36px", animation: "propReveal 0.5s ease both" }}>
            <h1 style={{
              fontFamily: "'Fraunces', Georgia, serif",
              fontSize: "34px", fontWeight: 700,
              color: "#F5F0E8",
              letterSpacing: "-0.5px",
              margin: "0 0 8px 0",
            }}>
              Craft a Proposal
            </h1>
            <p style={{
              fontSize: "16px", fontStyle: "italic",
              color: "rgba(245,240,232,0.35)",
            }}>
              Powered by Claude Sonnet + your Context-Mapper institutional memory.
            </p>
          </div>

          {/* Not professional warning */}
          {!isProfessional && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: "12px",
              padding: "16px 20px", borderRadius: "12px",
              background: "rgba(245,158,11,0.06)",
              border: "1px solid rgba(245,158,11,0.12)",
              marginBottom: "20px",
              animation: "propReveal 0.5s 0.05s ease both",
            }}>
              <span style={{ fontSize: "18px", marginTop: "1px" }}>⚠</span>
              <div>
                <div style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "14px", fontWeight: 600,
                  color: "#F59E0B",
                }}>Professional tier required</div>
                <div style={{ fontSize: "14px", color: "rgba(245,158,11,0.6)", marginTop: "2px" }}>
                  Context-Mapper AI generation requires the Professional plan ($249/mo).{" "}
                  <a href="/billing" style={{ color: "#F59E0B", textDecoration: "underline" }}>Upgrade →</a>
                </div>
              </div>
            </div>
          )}

          {/* Cold start indicator */}
          {isProfessional && coldStartPct !== null && coldStartPct < 100 && (
            <div style={{
              padding: "16px 20px", borderRadius: "12px",
              background: "rgba(245,158,11,0.04)",
              border: "1px solid rgba(245,158,11,0.08)",
              marginBottom: "20px",
              animation: "propReveal 0.5s 0.05s ease both",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                <span style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "13px", fontWeight: 500,
                  color: "#F59E0B",
                }}>
                  Context-Mapper warming up — {proposalsIndexed}/{COLD_START_THRESHOLD} proposals indexed
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "12px", color: "rgba(245,158,11,0.5)",
                }}>{Math.round(coldStartPct)}%</span>
              </div>
              <div style={{
                height: "3px", borderRadius: "2px",
                background: "rgba(255,255,255,0.04)",
                overflow: "hidden",
              }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  width: `${coldStartPct}%`,
                  background: "linear-gradient(90deg, #B45309, #F59E0B)",
                  transition: "width 0.5s ease",
                }} />
              </div>
              <p style={{ fontSize: "13px", color: "rgba(245,158,11,0.4)", marginTop: "8px", fontStyle: "italic" }}>
                Upload {COLD_START_THRESHOLD - (proposalsIndexed ?? 0)} more past proposals to unlock full personalization.{" "}
                <Link href="/onboarding" style={{ color: "#F59E0B", textDecoration: "underline" }}>Upload now →</Link>
              </p>
            </div>
          )}

          {/* Input panel */}
          <div style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: "18px",
            padding: "32px",
            marginBottom: "24px",
            animation: "propReveal 0.5s 0.1s ease both",
          }}>
            {/* Client name + Deal value row */}
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", marginBottom: "18px" }}>
              <div>
                <label style={{
                  display: "block",
                  fontFamily: "'Fraunces', serif",
                  fontSize: "13px", fontWeight: 500,
                  color: "rgba(245,240,232,0.5)",
                  marginBottom: "6px",
                }}>
                  Client name <span style={{ fontWeight: 300, fontStyle: "italic", color: "rgba(245,240,232,0.2)" }}>(optional)</span>
                </label>
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Brightfield Technologies"
                  className="prop-input"
                />
              </div>
              <div>
                <label style={{
                  display: "block",
                  fontFamily: "'Fraunces', serif",
                  fontSize: "13px", fontWeight: 500,
                  color: "rgba(245,240,232,0.5)",
                  marginBottom: "6px",
                }}>
                  Deal value <span style={{ fontWeight: 300, fontStyle: "italic", color: "rgba(245,240,232,0.2)" }}>(USD)</span>
                </label>
                <div style={{ position: "relative" }}>
                  <span style={{
                    position: "absolute", left: "16px", top: "50%",
                    transform: "translateY(-50%)",
                    color: "rgba(245,240,232,0.2)",
                    fontFamily: "'JetBrains Mono', monospace", fontSize: "14px",
                  }}>$</span>
                  <input
                    type="number"
                    value={valueUsd}
                    onChange={(e) => setValueUsd(e.target.value)}
                    placeholder="12500"
                    className="prop-input"
                    style={{ paddingLeft: "32px", fontFamily: "'JetBrains Mono', monospace", fontSize: "14px" }}
                  />
                </div>
              </div>
            </div>

            {/* RFP textarea */}
            <div style={{ marginBottom: "18px" }}>
              <label style={{
                display: "block",
                fontFamily: "'Fraunces', serif",
                fontSize: "13px", fontWeight: 500,
                color: "rgba(245,240,232,0.5)",
                marginBottom: "6px",
              }}>
                RFP / Brief <span style={{ color: "#F59E0B" }}>*</span>
              </label>
              <textarea
                value={rfpText}
                onChange={(e) => setRfpText(e.target.value)}
                rows={8}
                placeholder="Paste the client's RFP, project brief, or describe what they need…"
                className="prop-input prop-textarea"
              />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "8px" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  color: rfpText.length >= 50 ? "rgba(245,240,232,0.2)" : "rgba(245,158,11,0.4)",
                }}>
                  {rfpText.length} chars (min 50)
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  {EXAMPLE_RFPS.map((ex, i) => (
                    <button
                      key={i}
                      onClick={() => setRfpText(ex)}
                      style={{
                        background: "none", border: "none",
                        fontSize: "12px", color: "#F59E0B",
                        cursor: "pointer", textDecoration: "underline",
                        fontFamily: "'Crimson Pro', serif",
                        fontStyle: "italic",
                        opacity: 0.6,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "0.6"}
                    >
                      Example {i + 1}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {error && (
              <div style={{
                background: "rgba(220,38,38,0.06)",
                border: "1px solid rgba(220,38,38,0.12)",
                borderRadius: "8px",
                padding: "12px 16px",
                fontSize: "14px", color: "#F87171",
                marginBottom: "16px",
                fontStyle: "italic",
              }}>
                {error}
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || !isProfessional}
              style={{
                width: "100%",
                padding: "16px 24px",
                borderRadius: "12px",
                border: "none",
                background: generating
                  ? "linear-gradient(135deg, #92400E, #B45309)"
                  : "linear-gradient(135deg, #B45309, #F59E0B)",
                color: "#FEF3C7",
                fontFamily: "'Fraunces', serif",
                fontSize: "16px", fontWeight: 600,
                cursor: generating || !isProfessional ? "not-allowed" : "pointer",
                opacity: !isProfessional ? 0.4 : 1,
                transition: "all 0.25s",
                display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
              }}
              onMouseEnter={e => { if (!generating && isProfessional) { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 10px 32px rgba(245,158,11,0.2)"; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              {generating ? (
                <>
                  <span style={{
                    width: "16px", height: "16px",
                    border: "2px solid rgba(254,243,199,0.3)",
                    borderTopColor: "#FEF3C7",
                    borderRadius: "50%",
                    animation: "propSpin 0.6s linear infinite",
                  }} />
                  Generating with Context-Mapper…
                </>
              ) : (
                "✦ Generate Proposal"
              )}
            </button>
          </div>

          {/* Output panel */}
          {result && (
            <div style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "18px",
              padding: "32px",
              animation: "propReveal 0.4s ease both",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
                <h2 style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "20px", fontWeight: 600,
                  color: "#F5F0E8",
                  margin: 0,
                }}>
                  Generated Proposal {clientName ? <span style={{ fontStyle: "italic", fontWeight: 400 }}>for {clientName}</span> : ""}
                </h2>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button
                    onClick={toggleSectionMode}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: `1.5px solid ${sectionMode ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                      background: sectionMode ? "rgba(245,158,11,0.06)" : "rgba(255,255,255,0.02)",
                      color: sectionMode ? "#F59E0B" : "rgba(245,240,232,0.4)",
                      fontSize: "13px", cursor: "pointer",
                      fontFamily: "'Crimson Pro', serif",
                      transition: "all 0.2s",
                    }}
                  >
                    {sectionMode ? "✎ Editing" : "✎ Edit sections"}
                  </button>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "none",
                      background: "rgba(245,158,11,0.12)",
                      color: "#F59E0B",
                      fontSize: "13px", cursor: "pointer",
                      fontFamily: "'Crimson Pro', serif",
                      opacity: downloading ? 0.5 : 1,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(245,158,11,0.18)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(245,158,11,0.12)"}
                  >
                    {downloading ? "Downloading…" : "⬇ Download .docx"}
                  </button>
                  <Link
                    href="/dashboard"
                    style={{
                      padding: "8px 14px",
                      borderRadius: "8px",
                      border: "1.5px solid rgba(255,255,255,0.06)",
                      background: "transparent",
                      color: "rgba(245,240,232,0.35)",
                      fontSize: "13px",
                      textDecoration: "none",
                      fontFamily: "'Crimson Pro', serif",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.color = "rgba(245,240,232,0.6)"; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(245,240,232,0.35)"; }}
                  >
                    View in Dashboard →
                  </Link>
                </div>
              </div>

              {/* Section editing OR rendered content */}
              {sectionMode ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {sections.map((section, idx) => (
                    <div
                      key={idx}
                      style={{
                        borderRadius: "10px",
                        overflow: "hidden",
                        border: `1.5px solid ${editingSection === idx ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}`,
                      }}
                    >
                      <button
                        onClick={() => setEditingSection(editingSection === idx ? null : idx)}
                        style={{
                          width: "100%",
                          padding: "12px 16px",
                          textAlign: "left",
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          background: editingSection === idx ? "rgba(245,158,11,0.04)" : "rgba(255,255,255,0.02)",
                          border: "none",
                          cursor: "pointer",
                          transition: "background 0.2s",
                        }}
                        onMouseEnter={e => { if (editingSection !== idx) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                        onMouseLeave={e => { if (editingSection !== idx) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                      >
                        <span style={{
                          fontFamily: "'Fraunces', serif",
                          fontSize: "14px", fontWeight: 500,
                          color: "#F5F0E8",
                        }}>
                          {section.heading || "Introduction"}
                        </span>
                        <span style={{ fontSize: "11px", color: "rgba(245,240,232,0.2)" }}>
                          {editingSection === idx ? "▲ Collapse" : "▼ Edit"}
                        </span>
                      </button>
                      {editingSection === idx && (
                        <textarea
                          value={section.body}
                          onChange={(e) => updateSection(idx, e.target.value)}
                          rows={8}
                          style={{
                            width: "100%",
                            padding: "12px 16px",
                            borderTop: "1px solid rgba(255,255,255,0.06)",
                            background: "rgba(255,255,255,0.01)",
                            color: "#F5F0E8",
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: "13px",
                            border: "none",
                            borderTopStyle: "solid",
                            borderTopWidth: "1px",
                            borderTopColor: "rgba(255,255,255,0.06)",
                            resize: "none",
                            outline: "none",
                            lineHeight: 1.7,
                          }}
                        />
                      )}
                      {editingSection !== idx && (
                        <div style={{
                          padding: "10px 16px",
                          fontSize: "12px",
                          fontFamily: "'JetBrains Mono', monospace",
                          color: "rgba(245,240,232,0.15)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {section.body.slice(0, 120)}…
                        </div>
                      )}
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                    <button
                      onClick={() => {
                        if (result) {
                          setResult({ ...result, content: reassembleContent() });
                        }
                        setSectionMode(false);
                      }}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "8px",
                        border: "none",
                        background: "#F59E0B",
                        color: "#13110E",
                        fontFamily: "'Fraunces', serif",
                        fontSize: "13px", fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
                    >
                      Save edits
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{
                  borderRadius: "12px",
                  padding: "24px",
                  maxHeight: "500px",
                  overflowY: "auto",
                  background: "rgba(245,240,232,0.02)",
                  border: "1px solid rgba(255,255,255,0.04)",
                }}>
                  <div style={{
                    fontFamily: "'Crimson Pro', serif",
                    fontSize: "15px",
                    color: "rgba(245,240,232,0.6)",
                    lineHeight: 1.85,
                  }}>
                    <ReactMarkdown>{result.content}</ReactMarkdown>
                  </div>
                </div>
              )}

              {/* Rating */}
              <div style={{
                paddingTop: "18px",
                marginTop: "18px",
                borderTop: "1px solid rgba(255,255,255,0.04)",
              }}>
                <p style={{
                  fontFamily: "'Fraunces', serif",
                  fontSize: "14px", fontWeight: 500,
                  color: "rgba(245,240,232,0.4)",
                  marginBottom: "10px",
                }}>How good was this proposal?</p>
                {ratingSubmitted ? (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#34D399" }}>
                    <span>✓</span>
                    <span style={{ fontStyle: "italic" }}>Thanks — your rating helps improve future proposals.</span>
                  </div>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <StarRating value={starRating} onChange={handleStarChange} />
                    {ratingLoading && (
                      <span style={{ fontSize: "12px", color: "rgba(245,240,232,0.2)", animation: "propPulse 1s ease-in-out infinite" }}>Saving…</span>
                    )}
                  </div>
                )}
              </div>

              {/* Footer ID */}
              <div style={{
                display: "flex", alignItems: "center", gap: "8px",
                marginTop: "16px",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px",
                color: "rgba(245,240,232,0.12)",
              }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#F59E0B" }} />
                Generated with Claude Sonnet 4.6 + Context-Mapper · ID: {result.proposal_id.slice(0, 8)}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export default function NewProposalPage() {
  return (
    <Suspense fallback={null}>
      <NewProposalInner />
    </Suspense>
  );
}
