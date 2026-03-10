"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { analyticsApi, churnApi, supportApi } from "@/lib/api";

export default function AdminPage() {
    const { signOut } = useAuth();
    const [tickets, setTickets] = useState<any[]>([]);
    const [churnSignals, setChurnSignals] = useState<any[]>([]);
    const [phaseGate, setPhaseGate] = useState<any>(null);
    const [unitEcon, setUnitEcon] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [replyModal, setReplyModal] = useState<{ ticketId: string; subject: string } | null>(null);
    const [replyText, setReplyText] = useState("");

    useEffect(() => {
        Promise.all([
            supportApi.listTickets().then(setTickets),
            churnApi.listSignals().then(setChurnSignals),
            analyticsApi.phaseGate().then(setPhaseGate),
            analyticsApi.unitEconomics().then(setUnitEcon),
        ])
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    const handleReply = (ticket: any) => {
        setReplyText("");
        setReplyModal({ ticketId: ticket.id, subject: ticket.subject ?? "(no subject)" });
    };

    const submitReply = () => {
        // In a full integration this would POST to a reply endpoint.
        // For the demo, we show the composed message then close.
        alert(`Reply to ticket "${replyModal?.subject}":\n\n${replyText}`);
        setReplyModal(null);
        setReplyText("");
    };

    const mrr = unitEcon
        ? (unitEcon.blended_arpa_usd ?? 0) * (unitEcon.customer_count ?? 1)
        : null;
    const arr = mrr != null ? mrr * 12 : null;
    const churnRate = unitEcon?.monthly_churn_rate ?? null;
    const cac = unitEcon?.cac_usd ?? null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-gray-900 border-b flex-shrink-0 border-gray-800 px-6 py-4 flex items-center justify-between">
                <span className="text-white font-bold text-xl">Draftly Admin</span>
                <div className="flex gap-6 text-sm text-gray-300">
                    <Link href="/dashboard" className="hover:text-white">Back to App</Link>
                    <button
                        onClick={signOut}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto w-full p-6 py-12 flex-1 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Founder Dashboard</h1>
                    <p className="text-gray-500 mt-2">Manage customer support, view network churn, and review onboarding funnels.</p>
                </div>

                {/* ── Aggregate Metrics Header ── */}
                <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { label: "MRR", value: mrr != null ? `$${mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—" },
                        { label: "ARR", value: arr != null ? `$${arr.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—" },
                        { label: "Monthly Churn", value: churnRate != null ? `${(churnRate * 100).toFixed(1)}%` : "—", alarm: churnRate != null && churnRate > 0.055 },
                        { label: "CAC", value: cac != null ? (cac === 0 ? "$0 (organic)" : `$${cac.toFixed(0)}`) : "—" },
                    ].map(({ label, value, alarm }) => (
                        <div key={label} className={`bg-white rounded-xl border p-4 ${alarm ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                            <div className={`text-2xl font-bold ${alarm ? "text-red-600" : "text-gray-900"}`}>{loading ? <span className="animate-pulse">…</span> : value}</div>
                        </div>
                    ))}
                </section>

                {/* ── Phase Gate Tracker ── */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Phase 1 → 2 Gate</h2>
                    {loading || !phaseGate ? (
                        <div className="text-gray-400 animate-pulse">Loading gates…</div>
                    ) : (
                        <div className="space-y-3">
                            {[phaseGate.gate1, phaseGate.gate2, phaseGate.gate3].map((gate: any) => (
                                <div key={gate.label} className="flex items-center gap-3">
                                    <span className={`text-xl font-bold w-6 text-center ${gate.passed ? "text-green-500" : "text-red-400"}`}>
                                        {gate.passed ? "✓" : "✗"}
                                    </span>
                                    <span className="text-sm text-gray-700 flex-1">{gate.label}</span>
                                    <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                                        {typeof gate.current === "number" && gate.current < 1 && gate.current > 0
                                            ? `${(gate.current * 100).toFixed(1)}% / ${(gate.target * 100).toFixed(0)}%`
                                            : `${gate.current} / ${gate.target}`}
                                    </span>
                                </div>
                            ))}
                            <div className={`mt-2 text-sm font-medium ${phaseGate.all_passed ? "text-green-600" : "text-gray-400"}`}>
                                {phaseGate.all_passed ? "GTM Agent tier is unlocked!" : "Phase 1 in progress — meet all gates to unlock Phase 2."}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── Churn Risk Feed ── */}
                <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-900">Churn Risk Feed</h2>
                        <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-1 rounded-full">{churnSignals.length} at risk</span>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading churn signals…</div>
                    ) : churnSignals.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm">No churn risk signals detected.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {churnSignals.map((s: any) => (
                                <div key={s.id} className="p-5 flex items-center justify-between hover:bg-gray-50 transition-colors">
                                    <div>
                                        <div className="font-medium text-gray-900 text-sm">{s.customer_id}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                                            {s.usage_drop_pct != null && (
                                                <span className="text-red-500 font-medium">↓ {s.usage_drop_pct.toFixed(0)}% usage drop</span>
                                            )}
                                            {s.days_inactive != null && (
                                                <span>{s.days_inactive} days inactive</span>
                                            )}
                                            {s.flagged_at && (
                                                <span>Flagged {new Date(s.flagged_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button className="text-xs font-medium bg-amber-50 text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded transition-colors">
                                        Send Retention Email
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Support Queue ── */}
                <section className="bg-white rounded-xl flex-1 shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 px-6 py-4 flex items-center justify-between bg-gray-50">
                        <h2 className="text-lg font-bold text-gray-900">Support Queue</h2>
                        <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">{tickets.length} open</span>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-lg font-medium text-gray-900">Inbox Zero!</h3>
                            <p className="text-gray-500">No open support tickets.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {tickets.map(t => (
                                <div key={t.id} className="p-6 hover:bg-gray-50 transition-colors">
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="font-medium text-gray-900">{t.subject}</h3>
                                        <div className="flex items-center gap-2">
                                            {t.severity && (
                                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                    t.severity === "high" ? "bg-red-100 text-red-600"
                                                    : t.severity === "medium" ? "bg-amber-100 text-amber-600"
                                                    : "bg-green-100 text-green-600"
                                                }`}>{t.severity}</span>
                                            )}
                                            <span className="text-xs text-gray-400">{new Date(t.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                    <p className="text-sm text-gray-600 line-clamp-2">{t.body}</p>
                                    {t.ai_response && (
                                        <div className="mt-3 p-3 bg-teal-50 border border-teal-100 rounded text-xs text-teal-800">
                                            <span className="font-semibold">AI Response: </span>{t.ai_response}
                                        </div>
                                    )}
                                    <div className="mt-4 flex gap-3">
                                        <button
                                            onClick={() => handleReply(t)}
                                            className="text-xs font-medium text-teal-600 bg-teal-50 px-3 py-1.5 rounded hover:bg-teal-100 transition-colors"
                                        >
                                            Reply
                                        </button>
                                        <button className="text-xs font-medium text-gray-500 hover:text-gray-700 transition-colors">Mark Resolved</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>

            {/* ── Reply Modal ── */}
            {replyModal && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-1">Reply to Ticket</h3>
                        <p className="text-sm text-gray-500 mb-4">"{replyModal.subject}"</p>
                        <textarea
                            className="w-full border border-gray-200 rounded-lg p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-teal-400"
                            rows={6}
                            placeholder="Type your reply here…"
                            value={replyText}
                            onChange={e => setReplyText(e.target.value)}
                        />
                        <div className="flex justify-end gap-3 mt-4">
                            <button
                                onClick={() => setReplyModal(null)}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={submitReply}
                                disabled={!replyText.trim()}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                Send Reply
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
