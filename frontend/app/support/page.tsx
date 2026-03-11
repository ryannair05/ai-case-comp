"use client";

/**
 * Support page — Warm editorial feel.
 * Aesthetic: Like writing a letter. Cream/warm palette with terracotta accents.
 * Typography: Playfair Display (editorial serif) + Crimson Pro (refined body).
 */
import { useState, useEffect } from "react";
import { supportApi } from "@/lib/api";
import AppNav from "@/app/components/AppNav";

interface Ticket {
    id: string;
    subject: string;
    body: string;
    status: string;
    severity?: string;
    created_at?: string;
    ai_summary?: string;
}

export default function SupportPage() {
    const [subject, setSubject] = useState("");
    const [body, setBody] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(false);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loadingTickets, setLoadingTickets] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        supportApi
            .listTickets()
            .then((t) => setTickets(t as Ticket[]))
            .catch(() => { })
            .finally(() => setLoadingTickets(false));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!subject.trim() || !body.trim()) {
            setError("Please fill in both subject and message.");
            return;
        }
        setError(null);
        setSubmitting(true);
        try {
            await supportApi.createTicket(subject, body);
            setSuccess(true);
            setSubject("");
            setBody("");
            const updated = await supportApi.listTickets();
            setTickets(updated as Ticket[]);
            setTimeout(() => setSuccess(false), 5000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to submit ticket");
        } finally {
            setSubmitting(false);
        }
    };

    const statusColor = (status: string) => {
        switch (status) {
            case "resolved": return { bg: "rgba(22,163,74,0.08)", color: "#16A34A", border: "rgba(22,163,74,0.15)" };
            case "in_progress": return { bg: "rgba(180,83,9,0.06)", color: "#B45309", border: "rgba(180,83,9,0.12)" };
            default: return { bg: "rgba(120,113,108,0.06)", color: "#78716C", border: "rgba(120,113,108,0.1)" };
        }
    };

    return (
        <>
            <style>{`
        @keyframes supportReveal {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes supportSuccess {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .support-input {
          width: 100%;
          padding: 14px 18px;
          border: 1.5px solid #D6D0C4;
          border-radius: 8px;
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 16px;
          color: #292524;
          background: #FEFDFB;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .support-input::placeholder {
          color: #A8A29E;
          font-style: italic;
        }
        .support-input:focus {
          border-color: #B45309;
          box-shadow: 0 0 0 3px rgba(180,83,9,0.08);
        }
      `}</style>

            <div style={{
                minHeight: "100vh",
                background: "#FAF8F3",
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='4' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)' opacity='0.025'/%3E%3C/svg%3E")`,
            }}>
                <AppNav />

                <div style={{ maxWidth: "680px", margin: "0 auto", padding: "48px 24px" }}>

                    {/* Header */}
                    <div style={{ marginBottom: "40px", animation: "supportReveal 0.5s ease both" }}>
                        <h1 style={{
                            fontFamily: "'Playfair Display', Georgia, serif",
                            fontSize: "36px", fontWeight: 700,
                            color: "#1C1917",
                            letterSpacing: "-0.5px",
                            margin: "0 0 8px 0",
                        }}>
                            How can we help?
                        </h1>
                        <p style={{
                            fontFamily: "'Crimson Pro', Georgia, serif",
                            fontSize: "17px", fontStyle: "italic",
                            color: "#78716C",
                            lineHeight: 1.6,
                        }}>
                            Submit a ticket and our team will respond within 24 hours.
                            <br />AI triage routes urgent issues automatically.
                        </p>
                    </div>

                    {/* Success banner */}
                    {success && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: "14px",
                            padding: "16px 20px",
                            borderRadius: "10px",
                            background: "rgba(22,163,74,0.06)",
                            border: "1px solid rgba(22,163,74,0.12)",
                            marginBottom: "24px",
                            animation: "supportSuccess 0.3s ease both",
                        }}>
                            <div style={{
                                width: "28px", height: "28px", borderRadius: "50%",
                                background: "rgba(22,163,74,0.1)",
                                display: "flex", alignItems: "center", justifyContent: "center",
                                color: "#16A34A", fontSize: "14px", flexShrink: 0,
                            }}>✓</div>
                            <div>
                                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "14px", fontWeight: 600, color: "#166534" }}>
                                    Ticket submitted
                                </div>
                                <div style={{ fontFamily: "'Crimson Pro', serif", fontSize: "14px", color: "#16A34A", fontStyle: "italic", marginTop: "2px" }}>
                                    We&apos;ll respond within 24 hours. Check below for updates.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Submit form */}
                    <form
                        onSubmit={handleSubmit}
                        style={{
                            background: "#FEFDFB",
                            border: "1px solid #E7E0D5",
                            borderRadius: "16px",
                            padding: "32px",
                            marginBottom: "48px",
                            boxShadow: "0 4px 24px rgba(28,25,23,0.04)",
                            animation: "supportReveal 0.5s 0.1s ease both",
                        }}
                    >
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{
                                display: "block",
                                fontFamily: "'Playfair Display', serif",
                                fontSize: "14px", fontWeight: 600,
                                color: "#44403C",
                                marginBottom: "8px",
                            }}>Subject</label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Brief description of your issue"
                                className="support-input"
                            />
                        </div>
                        <div style={{ marginBottom: "20px" }}>
                            <label style={{
                                display: "block",
                                fontFamily: "'Playfair Display', serif",
                                fontSize: "14px", fontWeight: 600,
                                color: "#44403C",
                                marginBottom: "8px",
                            }}>Message</label>
                            <textarea
                                value={body}
                                onChange={(e) => setBody(e.target.value)}
                                placeholder="Describe your issue in detail…"
                                rows={6}
                                className="support-input"
                                style={{ resize: "none", lineHeight: 1.7 }}
                            />
                        </div>

                        {error && (
                            <div style={{
                                background: "rgba(220,38,38,0.05)",
                                border: "1px solid rgba(220,38,38,0.12)",
                                color: "#DC2626",
                                fontSize: "14px",
                                borderRadius: "8px",
                                padding: "12px 16px",
                                marginBottom: "16px",
                                fontFamily: "'Crimson Pro', serif",
                                fontStyle: "italic",
                            }}>
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                width: "100%",
                                padding: "14px 24px",
                                borderRadius: "10px",
                                border: "none",
                                background: "#B45309",
                                color: "#FEFDFB",
                                fontFamily: "'Playfair Display', serif",
                                fontSize: "15px", fontWeight: 600,
                                cursor: submitting ? "not-allowed" : "pointer",
                                transition: "all 0.2s",
                                opacity: submitting ? 0.6 : 1,
                            }}
                            onMouseEnter={e => { if (!submitting) { e.currentTarget.style.background = "#92400E"; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(180,83,9,0.2)"; } }}
                            onMouseLeave={e => { e.currentTarget.style.background = "#B45309"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                        >
                            {submitting ? "Submitting…" : "Submit Ticket"}
                        </button>
                    </form>

                    {/* Divider */}
                    <div style={{
                        display: "flex", alignItems: "center", gap: "16px",
                        marginBottom: "32px",
                        animation: "supportReveal 0.5s 0.2s ease both",
                    }}>
                        <div style={{ flex: 1, height: "1px", background: "#E7E0D5" }} />
                        <span style={{
                            fontFamily: "'Playfair Display', serif",
                            fontSize: "13px", fontWeight: 500,
                            color: "#A8A29E",
                            fontStyle: "italic",
                        }}>
                            Your Tickets
                        </span>
                        <div style={{ flex: 1, height: "1px", background: "#E7E0D5" }} />
                    </div>

                    {/* Ticket history */}
                    <div style={{ animation: "supportReveal 0.5s 0.3s ease both" }}>
                        {loadingTickets ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {[...Array(3)].map((_, i) => (
                                    <div key={i} style={{
                                        background: "#FEFDFB",
                                        border: "1px solid #E7E0D5",
                                        borderRadius: "12px",
                                        height: "80px",
                                        opacity: 0.5,
                                    }} />
                                ))}
                            </div>
                        ) : tickets.length === 0 ? (
                            <div style={{
                                textAlign: "center",
                                padding: "48px 24px",
                                border: "2px dashed #E7E0D5",
                                borderRadius: "16px",
                            }}>
                                <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.4 }}>📬</div>
                                <p style={{
                                    fontFamily: "'Crimson Pro', serif",
                                    fontSize: "16px", fontStyle: "italic",
                                    color: "#A8A29E",
                                }}>
                                    No tickets yet. Submit one above and we&apos;ll get back to you quickly.
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                {tickets.map((ticket, i) => {
                                    const sc = statusColor(ticket.status);
                                    return (
                                        <div
                                            key={ticket.id}
                                            style={{
                                                background: "#FEFDFB",
                                                border: "1px solid #E7E0D5",
                                                borderRadius: "14px",
                                                padding: "18px 22px",
                                                transition: "transform 0.2s, box-shadow 0.2s",
                                                animation: `supportReveal 0.4s ${0.3 + i * 0.05}s ease both`,
                                            }}
                                            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(28,25,23,0.06)"; }}
                                            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                                        >
                                            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                    <div style={{
                                                        fontFamily: "'Playfair Display', serif",
                                                        fontSize: "15px", fontWeight: 600,
                                                        color: "#1C1917",
                                                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                                                    }}>
                                                        {ticket.subject}
                                                    </div>
                                                    <div style={{
                                                        fontFamily: "'Crimson Pro', serif",
                                                        fontSize: "14px", color: "#78716C",
                                                        marginTop: "4px",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                        fontStyle: "italic",
                                                    }}>
                                                        {ticket.body}
                                                    </div>
                                                </div>
                                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                                                    <span style={{
                                                        fontSize: "11px", fontWeight: 600,
                                                        padding: "4px 10px",
                                                        borderRadius: "16px",
                                                        background: sc.bg,
                                                        border: `1px solid ${sc.border}`,
                                                        color: sc.color,
                                                        textTransform: "capitalize",
                                                        fontFamily: "'Anybody', sans-serif",
                                                    }}>
                                                        {ticket.status?.replace("_", " ") ?? "open"}
                                                    </span>
                                                    {ticket.created_at && (
                                                        <span style={{
                                                            fontSize: "11px",
                                                            fontFamily: "'Anybody', sans-serif",
                                                            color: "#A8A29E",
                                                        }}>
                                                            {new Date(ticket.created_at).toLocaleDateString()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            {ticket.ai_summary && (
                                                <div style={{
                                                    marginTop: "12px",
                                                    paddingTop: "12px",
                                                    borderTop: "1px solid #E7E0D5",
                                                    fontSize: "13px",
                                                    fontFamily: "'Crimson Pro', serif",
                                                    color: "#78716C",
                                                }}>
                                                    <span style={{
                                                        fontFamily: "'Playfair Display', serif",
                                                        fontWeight: 600,
                                                        color: "#B45309",
                                                        fontSize: "12px",
                                                    }}>AI Summary: </span>
                                                    {ticket.ai_summary}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
