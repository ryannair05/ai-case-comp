"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

export default function BillingPage() {
    const { signOut } = useAuth();
    const [loading, setLoading] = useState(false);

    // Real Stripe checkout flow — creates a hosted checkout session and redirects
    const handleUpgrade = async (tier: string) => {
        setLoading(true);
        try {
            const res = await fetch('/api/billing/create-checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tier })
            });
            const { url } = await res.json();
            window.location.href = url;
        } catch (err) {
            console.error('Checkout error:', err);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col">
            {/* Navbar */}
            <nav className="bg-white border-b flex-shrink-0 border-gray-100 px-6 py-4 flex items-center justify-between">
                <span className="text-teal-600 font-bold text-xl">Draftly</span>
                <div className="flex gap-6 text-sm text-gray-500">
                    <Link href="/dashboard">Dashboard</Link>
                    <Link href="/moat-meter">Moat Meter</Link>
                    <Link href="/billing" className="text-teal-600 font-medium">Billing</Link>
                    <button
                        onClick={signOut}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </nav>

            <main className="max-w-5xl mx-auto w-full p-6 py-12 flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Billing & Subscription</h1>
                <p className="text-gray-500 mb-8">Manage your plan, billing history, and payment methods.</p>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Current Plan: Starter</h2>
                        <p className="text-sm text-gray-500 mt-1">$99/month. Limited to 15 proposals.</p>
                    </div>
                    <button className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg text-sm font-medium transition-colors">
                        Manage via Stripe
                    </button>
                </div>

                <h3 className="text-lg font-bold text-gray-900 mb-4">Available Plans</h3>
                <div className="grid md:grid-cols-3 gap-6">
                    {/* Starter */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
                        <div className="font-bold text-gray-900 text-xl mb-1">Starter</div>
                        <div className="text-gray-500 mb-4 text-sm">Perfect for independent consultants</div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-6">$99<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex text-sm text-gray-600">✓ Up to 15 proposals</li>
                            <li className="flex text-sm text-gray-600">✓ Standard templates</li>
                        </ul>
                        <button disabled className="w-full py-2 bg-gray-100 text-gray-500 rounded-lg font-medium">Current Plan</button>
                    </div>

                    {/* Professional */}
                    <div className="bg-white border-2 border-teal-500 rounded-xl p-6 relative flex flex-col shadow-lg">
                        <div className="absolute top-0 right-0 bg-teal-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg rounded-tr-lg">POPULAR</div>
                        <div className="font-bold text-gray-900 text-xl mb-1">Professional</div>
                        <div className="text-gray-500 mb-4 text-sm">Unlock Context-Mapper</div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-6">$249<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex text-sm text-gray-600">✓ Unlimited proposals</li>
                            <li className="flex text-sm text-gray-900 font-medium">✓ Context-Mapper (RAG)</li>
                            <li className="flex text-sm text-gray-600">✓ Brand voice matching</li>
                        </ul>
                        <button onClick={() => handleUpgrade("Professional")} disabled={loading} className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors">
                            Upgrade to Pro
                        </button>
                    </div>

                    {/* GTM Agent (Phase 2) */}
                    <div className="bg-white border border-gray-200 rounded-xl p-6 flex flex-col">
                        <div className="font-bold text-gray-900 text-xl mb-1">GTM Agent</div>
                        <div className="text-gray-500 mb-4 text-sm">Full lifecycle sales automation</div>
                        <div className="text-3xl font-extrabold text-gray-900 mb-6">$399<span className="text-lg text-gray-400 font-normal">/mo</span></div>
                        <ul className="space-y-3 mb-8 flex-1">
                            <li className="flex text-sm text-gray-600">✓ Everything in Pro</li>
                            <li className="flex text-sm text-gray-900 font-medium">✓ Outreach sequences</li>
                            <li className="flex text-sm text-gray-900 font-medium">✓ CRM Meeting sync</li>
                            <li className="flex text-sm text-gray-600">✓ Win/Loss signal extraction</li>
                        </ul>
                        <button onClick={() => handleUpgrade("GTM Agent")} disabled={loading} className="w-full py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors">
                            Upgrade to GTM
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
