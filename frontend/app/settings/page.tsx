"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { crmApi, pipedriveApi } from "@/lib/api";
import { HubSpotStatus } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://api.draftly.ai";

export default function SettingsPage() {
  const { signOut } = useAuth();

  // Pipedrive
  const [pipedriveKey, setPipedriveKey] = useState("");
  const [pipedriveStatus, setPipedriveStatus] = useState<"idle" | "saving" | "connected" | "error">("idle");
  const [pipedriveError, setPipedriveError] = useState<string | null>(null);
  const [pipedriveConnected, setPipedriveConnected] = useState(false);

  // HubSpot
  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    pipedriveApi.status()
      .then((data) => { if (data?.connected) setPipedriveConnected(true); })
      .catch(() => {});

    crmApi.hubspotStatus()
      .then((data) => setHubspotStatus(data as HubSpotStatus))
      .catch(() => setHubspotStatus({ connected: false }));
  }, []);

  const handleSaveApiKey = async () => {
    if (!pipedriveKey.trim()) return;
    setPipedriveStatus("saving");
    setPipedriveError(null);
    try {
      await pipedriveApi.saveApiKey(pipedriveKey);
      setPipedriveStatus("connected");
      setPipedriveConnected(true);
      setPipedriveKey("");
    } catch (err: unknown) {
      setPipedriveStatus("error");
      setPipedriveError(err instanceof Error ? err.message : "Failed to save API key");
    }
  };

  const handleHubspotDisconnect = async () => {
    setDisconnecting(true);
    try {
      await crmApi.hubspotDisconnect();
      setHubspotStatus({ connected: false });
    } catch (err) {
      console.error("Disconnect failed:", err);
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--vellum)" }}>
      <AppNav />

      <main className="max-w-3xl mx-auto w-full p-6 py-12 flex-1 space-y-8">
        <div className="fade-up">
          <h1 className="text-3xl font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Settings</h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-secondary)" }}>
            Manage integrations, API keys, and account preferences.
          </p>
        </div>

        {/* ── Pipedrive Integration ── */}
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4 fade-up-1" style={{ borderColor: "var(--vellum-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>Pipedrive CRM</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                Sync won/lost proposals directly into Pipedrive as deals.
              </p>
            </div>
            {pipedriveConnected && (
              <span className="text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Connected
              </span>
            )}
          </div>

          {pipedriveConnected ? (
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
            <label className="block text-sm font-medium mb-1" style={{ color: "var(--ink-secondary)" }}>
              Pipedrive API Key
            </label>
            <div className="flex gap-3">
              <input
                type="password"
                value={pipedriveKey}
                onChange={(e) => setPipedriveKey(e.target.value)}
                placeholder="Paste your Pipedrive API token here…"
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                style={{ borderColor: "var(--vellum-border)" }}
                onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
              />
              <button
                onClick={handleSaveApiKey}
                disabled={!pipedriveKey.trim() || pipedriveStatus === "saving"}
                className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ background: "var(--indigo)" }}
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
        <section className="bg-white rounded-xl border shadow-sm p-6 space-y-4 fade-up-2" style={{ borderColor: "var(--vellum-border)" }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold" style={{ fontFamily: "Fraunces, Georgia, serif" }}>HubSpot CRM</h2>
              <p className="text-sm mt-0.5" style={{ color: "var(--ink-secondary)" }}>
                Connect HubSpot via OAuth to log deals automatically.
              </p>
            </div>
            {hubspotStatus?.connected && (
              <span className="text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-full">
                Connected
              </span>
            )}
          </div>

          {hubspotStatus === null ? (
            <div className="animate-pulse h-10 rounded-lg" style={{ background: "var(--vellum-border)" }} />
          ) : hubspotStatus.connected ? (
            <div className="space-y-3">
              <div className="bg-green-50 border border-green-100 rounded-lg p-4 text-sm text-green-800">
                HubSpot is connected
                {hubspotStatus.portal_id ? ` (Portal ID: ${hubspotStatus.portal_id})` : ""}.
                Proposals are automatically pushed as deals.
              </div>
              <button
                onClick={handleHubspotDisconnect}
                disabled={disconnecting}
                className="px-4 py-2 border text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                style={{ borderColor: "#FECACA", color: "#DC2626", background: "transparent" }}
              >
                {disconnecting ? "Disconnecting…" : "Disconnect HubSpot"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 text-sm text-amber-800">
                Connect HubSpot via OAuth to automatically log proposals as CRM deals.
              </div>
              <a
                href={`${API_BASE}/crm/hubspot/connect`}
                className="inline-block px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors"
                style={{ background: "#FF7A59" }}
              >
                Connect HubSpot →
              </a>
            </div>
          )}
        </section>

        <div className="text-center fade-up-3">
          <Link href="/dashboard" className="text-sm hover:underline" style={{ color: "var(--ink-secondary)" }}>
            ← Back to Dashboard
          </Link>
        </div>

        <div className="text-center fade-up-3">
          <button onClick={signOut} className="text-sm hover:underline" style={{ color: "var(--ink-muted)" }}>
            Sign out
          </button>
        </div>
      </main>
    </div>
  );
}
