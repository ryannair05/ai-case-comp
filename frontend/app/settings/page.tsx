"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.draftly.ai";

function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("draftly_token") ?? "";
}

async function apiPost(path: string, body: object) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? err.reason ?? "Request failed");
  }
  return res.json();
}

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) return null;
  return res.json();
}

export default function SettingsPage() {
  const { signOut } = useAuth();
  const [pipedriveKey, setPipedriveKey] = useState("");
  const [pipedriveStatus, setPipedriveStatus] = useState<"idle" | "saving" | "connected" | "error">("idle");
  const [pipedriveError, setPipedriveError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    apiGet("/crm/pipedrive/status").then((data) => {
      if (data?.connected) setConnected(true);
    });
  }, []);

  const handleSaveApiKey = async () => {
    if (!pipedriveKey.trim()) return;
    setPipedriveStatus("saving");
    setPipedriveError(null);
    try {
      await apiPost("/crm/pipedrive/save-key", { api_key: pipedriveKey });
      setPipedriveStatus("connected");
      setConnected(true);
      setPipedriveKey("");
    } catch (err: any) {
      setPipedriveStatus("error");
      setPipedriveError(err.message ?? "Failed to save API key");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
        <span className="text-teal-600 font-bold text-xl">Draftly</span>
        <div className="flex gap-6 text-sm text-gray-500">
          <Link href="/dashboard">Dashboard</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/settings" className="text-teal-600 font-medium">Settings</Link>
          <button onClick={signOut} className="text-gray-400 hover:text-gray-600 transition-colors">
            Sign out
          </button>
        </div>
      </nav>

      <main className="max-w-3xl mx-auto w-full p-6 py-12 flex-1 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-2">Manage integrations, API keys, and account preferences.</p>
        </div>

        {/* ── Pipedrive Integration ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Pipedrive CRM</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                Sync won/lost proposals directly into Pipedrive as deals.
              </p>
            </div>
            {connected && (
              <span className="text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Connected
              </span>
            )}
          </div>

          {connected ? (
            <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-green-800">
              Pipedrive is connected. Winning and losing proposals will automatically sync as deals.
              To update your API key, enter a new one below.
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800">
              Connect your Pipedrive account to automatically log proposals as deals.
              Find your API key under <strong>Pipedrive → Account → Personal Preferences → API</strong>.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Pipedrive API Key
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={pipedriveKey}
                onChange={(e) => setPipedriveKey(e.target.value)}
                placeholder="Paste your Pipedrive API token here…"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!pipedriveKey.trim() || pipedriveStatus === "saving"}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-200 disabled:text-gray-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {pipedriveStatus === "saving" ? "Verifying…" : "Save & Connect"}
              </button>
            </div>
            {pipedriveStatus === "error" && pipedriveError && (
              <p className="text-xs text-red-600 mt-2">{pipedriveError}</p>
            )}
            {pipedriveStatus === "connected" && (
              <p className="text-xs text-green-600 mt-2">Pipedrive connected successfully.</p>
            )}
          </div>
        </section>

        {/* ── HubSpot Integration ── */}
        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">HubSpot CRM</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Connect HubSpot via OAuth to log deals automatically.
            </p>
          </div>
          <a
            href={`${API_BASE}/crm/hubspot/connect`}
            className="inline-block px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Connect HubSpot →
          </a>
        </section>
      </main>
    </div>
  );
}
