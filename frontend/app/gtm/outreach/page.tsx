"use client";

import { useState } from "react";
import Link from "next/link";
import { gtmApi } from "@/lib/api";

export default function OutreachPage() {
    const [form, setForm] = useState({ name: "", company: "", industry: "", painPoint: "" });
    const [loading, setLoading] = useState(false);
    const [sequence, setSequence] = useState<any[] | null>(null);

    const handleGenerate = async () => {
        if (!form.name || !form.company) return alert("Required fields missing");
        setLoading(true);
        try {
            const res = await gtmApi.generateOutreachSequence(form.name, form.company, form.industry, form.painPoint, 3);
            setSequence(res);
        } catch (e: any) {
            alert("Error generating: " + e.message);
        }
        setLoading(false);
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <nav className="bg-white border-b px-6 py-4 flex items-center gap-6">
                <span className="text-teal-600 font-bold text-xl">Draftly GTM</span>
                <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-800">Back to Dashboard</Link>
                <Link href="/gtm/meeting-signals" className="text-sm text-gray-500 hover:text-gray-800">Meeting Signals</Link>
                <Link href="/gtm/outreach" className="text-sm text-teal-600 font-medium">Outreach Sequence</Link>
            </nav>

            <div className="max-w-5xl mx-auto p-6 mt-8 flex flex-col md:flex-row gap-8">
                {/* Left Col: Setup */}
                <div className="flex-1 space-y-4">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Generate Outreach Sequence</h1>
                    <p className="text-gray-500 mb-6 text-sm">Create a hyper-personalized email drip sequence using your validated Context-Mapper win stories.</p>

                    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Prospect Name</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Company</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} placeholder="Stark Industries" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Industry</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={form.industry} onChange={e => setForm({ ...form, industry: e.target.value })} placeholder="Defense Tech" />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Identified Pain Point</label>
                            <input type="text" className="w-full border rounded-lg p-2 text-sm" value={form.painPoint} onChange={e => setForm({ ...form, painPoint: e.target.value })} placeholder="Scaling costs and compliance..." />
                        </div>
                        <button disabled={loading} onClick={handleGenerate} className="w-full bg-teal-600 text-white font-medium py-2 rounded-lg hover:bg-teal-700 transition">
                            {loading ? "Generating..." : "Generate 3-Step Sequence"}
                        </button>
                    </div>
                </div>

                {/* Right Col: Output */}
                <div className="flex-1">
                    {sequence ? (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-gray-900">Generated Sequence</h2>
                            {sequence.map((email, i) => (
                                <div key={i} className="bg-white border rounded-xl p-5 shadow-sm">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-xs font-bold bg-teal-100 text-teal-800 px-2 py-1 rounded">Day {email.send_day ?? (i + 1)}</span>
                                    </div>
                                    <div className="text-sm font-bold text-gray-900 mb-2">Subject: {email.subject}</div>
                                    <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{email.body}</div>
                                    {email.cta && (
                                        <div className="mt-4 pt-3 border-t text-sm font-medium text-indigo-600">CTA: {email.cta}</div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="h-full border-2 border-dashed border-gray-200 rounded-xl flex items-center justify-center text-gray-400 p-8 text-center bg-gray-50">
                            Fill out the prospect details to automatically blend your product value with relevant case studies.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
