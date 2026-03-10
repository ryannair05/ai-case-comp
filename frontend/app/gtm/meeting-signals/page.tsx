"use client";

import { useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";

export default function MeetingSignalsPage() {
    const [notes, setNotes] = useState("");
    const [clientName, setClientName] = useState("");
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<any>(null);

    const handleExtract = async () => {
        if (!notes || !clientName) return alert("Please provide notes and client name.");
        setLoading(true);
        try {
            const res = await gtmApi.extractMeetingSignals(notes, clientName);
            setResult(res);
        } catch (e: any) {
            alert("Error extracting: " + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b px-6 py-4 flex items-center gap-6">
                <span className="text-teal-600 font-bold text-xl">Draftly GTM</span>
                <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Back to Dashboard</Link>
                <Link href="/gtm/meeting-signals" className="text-sm text-teal-600 font-medium">Meeting Signals</Link>
                <Link href="/gtm/outreach" className="text-sm text-gray-500 hover:text-gray-800">Outreach Sequence</Link>
            </nav>

            <div className="max-w-4xl mx-auto p-6 mt-8">
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Meeting Signal Extractor</h1>
                <p className="text-gray-500 mb-8">Paste your raw call notes. Our AI will extract structured CRM signals to update your deal automatically.</p>

                <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Prospect / Client Name</label>
                        <input
                            value={clientName}
                            onChange={e => setClientName(e.target.value)}
                            placeholder="E.g., Acme Corp"
                            className="w-full border p-2 rounded-lg text-sm"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Raw Meeting Notes</label>
                        <textarea
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="- CEO wants to move fast... needs scale..."
                            className="w-full border p-3 rounded-lg text-sm h-48"
                        />
                    </div>
                    <button
                        disabled={loading}
                        onClick={handleExtract}
                        className="w-full bg-teal-600 text-white rounded-lg py-2 font-medium hover:bg-teal-700 transition"
                    >
                        {loading ? "Extracting..." : "Extract Signals"}
                    </button>
                </div>

                {result && (
                    <div className="mt-8 bg-gray-900 rounded-xl p-6 text-green-400 font-mono text-sm overflow-auto shadow-lg">
                        <h3 className="text-white text-lg font-bold mb-4 sans-serif">Extracted CRM Payload</h3>
                        <pre>{JSON.stringify(result, null, 2)}</pre>
                    </div>
                )}
            </div>
        </div>
    );
}
