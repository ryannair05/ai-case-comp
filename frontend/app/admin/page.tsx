"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { analyticsApi, churnApi, supportApi } from "@/lib/api";

export default function AdminPage() {
    const { user, signOut } = useAuth();
    const router = useRouter();
    const [tickets, setTickets] = useState<any[]>([]);
    const [ticketTotal, setTicketTotal] = useState(0);
    const [ticketPage, setTicketPage] = useState(1);
    const [severityFilter, setSeverityFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [churnSignals, setChurnSignals] = useState<any[]>([]);
    const [phaseGate, setPhaseGate] = useState<any>(null);
    const [unitEcon, setUnitEcon] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [replyModal, setReplyModal] = useState<{ ticketId: string; subject: string } | null>(null);
    const [replyText, setReplyText] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [retentionSending, setRetentionSending] = useState<string | null>(null);
    const [retentionSent, setRetentionSent] = useState<Set<string>>(new Set());

    // Redirect non-admins
    useEffect(() => {
        if (!loading && user && !(user as any).isAdmin) {
            router.replace("/dashboard");
        }
    }, [user, loading, router]);

    const fetchTickets = async (page = ticketPage, severity = severityFilter, status = statusFilter) => {
        try {
            const data = await supportApi.listAllTickets({
                ...(severity ? { severity } : {}),
                ...(status ? { status } : {}),
                page,
            });
            setTickets(data.tickets ?? []);
            setTicketTotal(data.total ?? 0);
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        Promise.all([
            analyticsApi.phaseGate().then(setPhaseGate),
            analyticsApi.aggregateUnitEconomics().then(setUnitEcon),
            churnApi.listAllSignals().then(setChurnSignals),
            fetchTickets(1, "", ""),
        ])
            .catch(console.error)
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const applyFilters = () => {
        setTicketPage(1);
        fetchTickets(1, severityFilter, statusFilter);
    };

    const handleReply = (ticket: any) => {
        setReplyText("");
        setReplyModal({ ticketId: ticket.id, subject: ticket.subject ?? "(no subject)" });
    };

    const submitReply = async () => {
        if (!replyModal || !replyText.trim()) return;
        setSubmitting(true);
        try {
            await supportApi.replyToTicket(replyModal.ticketId, replyText.trim());
            setReplyModal(null);
            setReplyText("");
            fetchTickets(ticketPage, severityFilter, statusFilter);
        } catch (e) {
            console.error(e);
        } finally {
            setSubmitting(false);
        }
    };

    const handleResolve = async (ticketId: string) => {
        try {
            await supportApi.resolveTicket(ticketId);
            fetchTickets(ticketPage, severityFilter, statusFilter);
        } catch (e) {
            console.error(e);
        }
    };

    const handleRetentionEmail = async (signalId: string) => {
        setRetentionSending(signalId);
        try {
            await churnApi.sendRetentionEmail(signalId);
            setRetentionSent(prev => new Set(prev).add(signalId));
        } catch (e) {
            console.error(e);
        } finally {
            setRetentionSending(null);
        }
    };

    const mrr = unitEcon?.total_mrr ?? null;
    const arr = mrr != null ? mrr * 12 : null;
    const churnRate = unitEcon?.monthly_churn_rate ?? null;
    const customerCount = unitEcon?.customer_count ?? null;
    const ltv = unitEcon?.ltv_usd ?? null;

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            <nav className="bg-gray-900 border-b flex-shrink-0 border-gray-800 px-6 py-4 flex items-center justify-between">
                <span className="text-white font-bold text-xl">Draftly Admin</span>
                <div className="flex gap-6 text-sm text-gray-300">
                    <Link href="/dashboard" className="hover:text-white">Back to App</Link>
                    <button onClick={signOut} className="text-gray-400 hover:text-white transition-colors">
                        Sign out
                    </button>
                </div>
            </nav>

            <main className="max-w-6xl mx-auto w-full p-6 py-12 flex-1 space-y-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Founder Dashboard</h1>
                    <p className="text-gray-500 mt-2">Manage customer support, view churn signals, and track phase gate metrics.</p>
                </div>

                {/* ── Aggregate Metrics Header ── */}
                <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {[
                        { label: "MRR", value: mrr != null ? `$${Math.round(mrr).toLocaleString()}` : "—" },
                        { label: "ARR", value: arr != null ? `$${Math.round(arr).toLocaleString()}` : "—" },
                        { label: "Customers", value: customerCount != null ? customerCount : "—" },
                        { label: "Monthly Churn", value: churnRate != null ? `${(churnRate * 100).toFixed(1)}%` : "—", alarm: churnRate != null && churnRate > 0.055 },
                        { label: "LTV", value: ltv != null ? `$${Math.round(ltv).toLocaleString()}` : "—" },
                    ].map(({ label, value, alarm }) => (
                        <div key={label} className={`bg-white rounded-xl border p-4 ${alarm ? "border-red-200 bg-red-50" : "border-gray-100"}`}>
                            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</div>
                            <div className={`text-2xl font-bold ${alarm ? "text-red-600" : "text-gray-900"}`}>
                                {loading ? <span className="animate-pulse">…</span> : value}
                            </div>
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
                        <span className="text-xs font-medium bg-red-100 text-red-600 px-2 py-1 rounded-full">
                            {churnSignals.length} at risk
                        </span>
                    </div>
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading churn signals…</div>
                    ) : churnSignals.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 text-sm">No churn risk signals detected.</div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {churnSignals.map((s: any) => (
                                <div key={s.id} className="p-5 flex items-start justify-between hover:bg-gray-50 transition-colors">
                                    <div className="flex-1">
                                        <div className="font-medium text-gray-900 text-sm">{s.customer_name ?? s.customer_id}</div>
                                        <div className="text-xs text-gray-500 mt-0.5 space-x-3">
                                            <span className="font-medium text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{s.customer_tier}</span>
                                            <span className="text-emerald-600 font-medium">${s.customer_mrr?.toFixed(0) ?? 0}/mo</span>
                                            {s.usage_drop_pct != null && (
                                                <span className="text-red-500 font-medium">↓ {s.usage_drop_pct.toFixed(0)}% usage drop</span>
                                            )}
                                            {s.days_inactive != null && s.days_inactive > 0 && (
                                                <span>{s.days_inactive} days inactive</span>
                                            )}
                                            {s.flagged_at && (
                                                <span>Flagged {new Date(s.flagged_at).toLocaleDateString()}</span>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleRetentionEmail(s.id)}
                                        disabled={retentionSending === s.id || retentionSent.has(s.id)}
                                        className={`text-xs font-medium px-3 py-1.5 rounded transition-colors ml-4 ${
                                            retentionSent.has(s.id)
                                                ? "bg-green-50 text-green-600"
                                                : "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                        }`}
                                    >
                                        {retentionSent.has(s.id) ? "Sent ✓" : retentionSending === s.id ? "Sending…" : "Send Retention Email"}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Support Queue ── */}
                <section className="bg-white rounded-xl flex-1 shadow-sm border border-gray-200 overflow-hidden">
                    <div className="border-b border-gray-200 px-6 py-4 bg-gray-50">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-bold text-gray-900">Support Queue</h2>
                            <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-1 rounded-full">
                                {ticketTotal} total
                            </span>
                        </div>
                        {/* Filters */}
                        <div className="flex gap-3 flex-wrap">
                            <select
                                value={severityFilter}
                                onChange={e => setSeverityFilter(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                            >
                                <option value="">All Severities</option>
                                <option value="high">High</option>
                                <option value="medium">Medium</option>
                                <option value="low">Low</option>
                            </select>
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400"
                            >
                                <option value="">All Statuses</option>
                                <option value="open">Open</option>
                                <option value="escalated">Escalated</option>
                                <option value="ai_handled">AI Handled</option>
                                <option value="closed">Closed</option>
                            </select>
                            <button
                                onClick={applyFilters}
                                className="text-xs font-medium bg-teal-600 text-white px-3 py-1.5 rounded-lg hover:bg-teal-700 transition-colors"
                            >
                                Apply Filters
                            </button>
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Loading tickets...</div>
                    ) : tickets.length === 0 ? (
                        <div className="p-12 text-center flex flex-col items-center">
                            <div className="text-4xl mb-4">🎉</div>
                            <h3 className="text-lg font-medium text-gray-900">Inbox Zero!</h3>
                            <p className="text-gray-500">No tickets match your filters.</p>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y divide-gray-100">
                                {tickets.map((t: any) => (
                                    <div key={t.id} className="p-6 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between items-start mb-2">
                                            <div>
                                                <h3 className="font-medium text-gray-900">{t.subject || "(no subject)"}</h3>
                                                <div className="text-xs text-gray-400 mt-0.5">
                                                    {t.customer_name ?? t.customer_id} ·{" "}
                                                    <span className="font-medium text-gray-600">{t.customer_tier}</span>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                                                {t.severity && (
                                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                                        t.severity === "high" ? "bg-red-100 text-red-600"
                                                        : t.severity === "medium" ? "bg-amber-100 text-amber-600"
                                                        : "bg-green-100 text-green-600"
                                                    }`}>{t.severity}</span>
                                                )}
                                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                    t.status === "closed" ? "bg-gray-100 text-gray-500"
                                                    : t.status === "escalated" ? "bg-red-100 text-red-600"
                                                    : t.status === "ai_handled" ? "bg-blue-100 text-blue-600"
                                                    : "bg-yellow-100 text-yellow-700"
                                                }`}>{t.status}</span>
                                                <span className="text-xs text-gray-400">
                                                    {t.created_at ? new Date(t.created_at).toLocaleDateString() : ""}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 line-clamp-2">{t.body}</p>
                                        {t.ai_response && (
                                            <div className="mt-3 p-3 bg-teal-50 border border-teal-100 rounded text-xs text-teal-800">
                                                <span className="font-semibold">AI Response: </span>{t.ai_response}
                                            </div>
                                        )}
                                        {t.admin_reply && (
                                            <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded text-xs text-blue-800">
                                                <span className="font-semibold">Admin Reply: </span>{t.admin_reply}
                                            </div>
                                        )}
                                        <div className="mt-4 flex gap-3">
                                            <button
                                                onClick={() => handleReply(t)}
                                                className="text-xs font-medium text-teal-600 bg-teal-50 px-3 py-1.5 rounded hover:bg-teal-100 transition-colors"
                                            >
                                                Reply
                                            </button>
                                            {t.status !== "closed" && (
                                                <button
                                                    onClick={() => handleResolve(t.id)}
                                                    className="text-xs font-medium text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded transition-colors"
                                                >
                                                    Mark Resolved
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {/* Pagination */}
                            {ticketTotal > 20 && (
                                <div className="border-t border-gray-100 px-6 py-4 flex items-center justify-between">
                                    <span className="text-xs text-gray-500">
                                        Page {ticketPage} of {Math.ceil(ticketTotal / 20)}
                                    </span>
                                    <div className="flex gap-2">
                                        <button
                                            disabled={ticketPage <= 1}
                                            onClick={() => {
                                                const p = ticketPage - 1;
                                                setTicketPage(p);
                                                fetchTickets(p, severityFilter, statusFilter);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                                        >
                                            ← Prev
                                        </button>
                                        <button
                                            disabled={ticketPage >= Math.ceil(ticketTotal / 20)}
                                            onClick={() => {
                                                const p = ticketPage + 1;
                                                setTicketPage(p);
                                                fetchTickets(p, severityFilter, statusFilter);
                                            }}
                                            className="text-xs px-3 py-1.5 rounded border border-gray-200 disabled:opacity-40 hover:bg-gray-50 transition-colors"
                                        >
                                            Next →
                                        </button>
                                    </div>
                                </div>
                            )}
                        </>
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
                                disabled={!replyText.trim() || submitting}
                                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {submitting ? "Sending…" : "Send Reply"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
