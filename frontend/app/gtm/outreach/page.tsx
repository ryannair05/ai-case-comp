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
    <>
      <style>{`
        @keyframes dashFadeUp {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: dashFadeUp 0.4s ease both; }
        .fade-up-1 { animation: dashFadeUp 0.4s 0.1s ease both; }
      `}</style>

      <div style={{ minHeight: "100vh", background: "#0B0F1A", fontFamily: "'DM Sans', sans-serif" }}>
        <AppNav />

        <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "32px 24px" }} className="flex flex-col md:flex-row gap-8">
          {/* Left Col: Setup */}
          <div className="md:w-80 shrink-0 space-y-4 fade-up">
            <h1 style={{
              fontFamily: "'Outfit', sans-serif", fontSize: "24px",
              fontWeight: 600, color: "#E2E8F0", margin: 0,
            }}>
              Outreach Sequence
            </h1>
            <p style={{ fontSize: "14px", color: "rgba(148,163,184,0.5)", lineHeight: 1.5 }}>
              Hyper-personalized email drip using your Context-Mapper win stories.
            </p>

            <div style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "16px",
              padding: "24px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
            }}>
              {[
                { key: "name" as const, label: "Prospect Name", placeholder: "Jane Doe" },
                { key: "company" as const, label: "Company", placeholder: "Stark Industries" },
                { key: "industry" as const, label: "Industry", placeholder: "Defense Tech" },
                { key: "painPoint" as const, label: "Pain Point", placeholder: "Scaling costs and compliance…" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label style={{
                    display: "block", fontSize: "12px", fontWeight: 500,
                    color: "rgba(148,163,184,0.6)", marginBottom: "6px",
                    fontFamily: "'Outfit', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px",
                  }}>
                    {label}
                  </label>
                  <input
                    type="text"
                    style={{
                      width: "100%", padding: "10px 14px",
                      background: "rgba(255,255,255,0.03)",
                      border: "1.5px solid rgba(99,102,241,0.15)",
                      borderRadius: "10px",
                      fontSize: "13px", color: "#E2E8F0",
                      outline: "none",
                      transition: "all 0.2s",
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.4)"}
                    onBlur={e => e.currentTarget.style.borderColor = "rgba(99,102,241,0.15)"}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                  />
                </div>
              ))}

              {/* Sequence length dropdown */}
              <div>
                <label style={{
                  display: "block", fontSize: "12px", fontWeight: 500,
                  color: "rgba(148,163,184,0.6)", marginBottom: "6px",
                  fontFamily: "'Outfit', sans-serif", textTransform: "uppercase", letterSpacing: "0.5px",
                }}>
                  Sequence length
                </label>
                <select
                  value={sequenceLength}
                  onChange={(e) => setSequenceLength(Number(e.target.value))}
                  style={{
                    width: "100%", padding: "10px 14px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1.5px solid rgba(99,102,241,0.15)",
                    borderRadius: "10px",
                    fontSize: "13px", color: "#E2E8F0",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {SEQUENCE_LENGTHS.map((n) => (
                    <option key={n} value={n} style={{ background: "#13151F" }}>
                      {n} emails
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div style={{
                  background: "rgba(248,113,113,0.06)",
                  border: "1px solid rgba(248,113,113,0.15)",
                  color: "#F87171",
                  fontSize: "12px",
                  borderRadius: "10px",
                  padding: "10px 14px",
                }}>
                  {error}
                </div>
              )}

              <button
                disabled={loading}
                onClick={handleGenerate}
                style={{
                  width: "100%", padding: "12px",
                  borderRadius: "10px",
                  border: "none",
                  background: loading ? "rgba(99,102,241,0.5)" : "linear-gradient(135deg, #6366F1, #4F46E5)",
                  fontSize: "13px", fontWeight: 600,
                  color: "#fff",
                  cursor: loading ? "not-allowed" : "pointer",
                  fontFamily: "'Outfit', sans-serif",
                  transition: "all 0.2s",
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = "0 8px 20px rgba(99,102,241,0.3)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "none"; }}
              >
                {loading ? "Generating…" : `✦ Generate ${sequenceLength}-Step Sequence`}
              </button>
            </div>
          </div>

          {/* Right Col: Output */}
          <div className="flex-1 fade-up-1">
            {sequence ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <h2 style={{
                    fontFamily: "'Outfit', sans-serif", fontSize: "18px",
                    fontWeight: 600, color: "#E2E8F0", margin: 0,
                  }}>
                    Generated Sequence
                  </h2>
                  <button
                    onClick={handleExportCsv}
                    style={{
                      fontSize: "12px", fontWeight: 500,
                      padding: "6px 14px", borderRadius: "8px",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                      color: "#818CF8",
                      cursor: "pointer",
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.03)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
                  >
                    ↓ Export CSV
                  </button>
                </div>
                {sequence.map((email, i) => (
                  <div key={i} style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "16px",
                    padding: "24px",
                    transition: "all 0.25s",
                  }}
                    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.2)"; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"; }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                      <span style={{
                        fontSize: "10px", fontWeight: 700,
                        textTransform: "uppercase", letterSpacing: "1px",
                        padding: "4px 8px", borderRadius: "6px",
                        background: "rgba(99,102,241,0.1)", color: "#818CF8",
                        fontFamily: "'Outfit', sans-serif",
                      }}>
                        Day {email.send_day ?? (i + 1)}
                      </span>
                      <button
                        onClick={() => handleCopy(email, i)}
                        style={{
                          fontSize: "11px", fontWeight: 500,
                          padding: "4px 12px", borderRadius: "16px",
                          border: `1px solid ${copied === i ? "#34D399" : "rgba(255,255,255,0.08)"}`,
                          color: copied === i ? "#34D399" : "rgba(226,232,240,0.5)",
                          background: copied === i ? "rgba(52,211,153,0.06)" : "transparent",
                          cursor: "pointer",
                          transition: "all 0.2s",
                        }}
                      >
                        {copied === i ? "✓ Copied" : "Copy"}
                      </button>
                    </div>
                    <div style={{
                      fontSize: "15px", fontWeight: 600,
                      color: "#E2E8F0", marginBottom: "12px",
                      fontFamily: "'Outfit', sans-serif",
                    }}>
                      Subject: {email.subject}
                    </div>
                    <div style={{
                      fontSize: "14px", color: "rgba(226,232,240,0.7)",
                      whiteSpace: "pre-wrap", lineHeight: 1.6,
                    }}>
                      {email.body}
                    </div>
                    {email.cta && (
                      <div style={{
                        marginTop: "16px",
                        borderTop: "1px solid rgba(255,255,255,0.04)",
                        paddingTop: "12px",
                        fontSize: "13px", fontWeight: 600,
                        color: "#818CF8",
                        fontFamily: "'Outfit', sans-serif",
                      }}>
                        CTA: {email.cta}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div
                style={{
                  height: "100%", minHeight: "300px",
                  border: "1.5px dashed rgba(255,255,255,0.06)",
                  borderRadius: "16px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "32px", textAlign: "center",
                }}
              >
                <div style={{ maxWidth: "320px" }}>
                  <div style={{ fontSize: "40px", marginBottom: "16px", opacity: 0.6 }}>✦</div>
                  <p style={{ fontSize: "14px", color: "rgba(148,163,184,0.4)", lineHeight: 1.6 }}>
                    Fill out the prospect details to generate a personalized sequence blending your product value with relevant case studies.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
