"use client";

/**
 * Settings page — Minimal utilitarian.
 * Aesthetic: Clean, spare, functional. Almost brutalist in restraint.
 * Tinted off-white with sharp typographic hierarchy.
 * Typography: Syne (geometric headings) + DM Sans (body).
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { crmApi, pipedriveApi } from "@/lib/api";
import { HubSpotStatus } from "@/lib/types";
import AppNav from "@/app/components/AppNav";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080";

export default function SettingsPage() {
  const { signOut } = useAuth();

  const [pipedriveKey, setPipedriveKey] = useState("");
  const [pipedriveStatus, setPipedriveStatus] = useState<"idle" | "saving" | "connected" | "error">("idle");
  const [pipedriveError, setPipedriveError] = useState<string | null>(null);
  const [pipedriveConnected, setPipedriveConnected] = useState(false);

  const [hubspotStatus, setHubspotStatus] = useState<HubSpotStatus | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  useEffect(() => {
    pipedriveApi.status()
      .then((data) => { if (data?.connected) setPipedriveConnected(true); })
      .catch(() => { });

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
    <>
      <style>{`
        @keyframes settReveal {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .sett-input {
          width: 100%;
          padding: 11px 14px;
          border: 1.5px solid #D4D4D8;
          border-radius: 6px;
          font-family: 'DM Sans', sans-serif;
          font-size: 14px;
          color: #18181B;
          background: #FAFAFA;
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .sett-input::placeholder { color: #A1A1AA; }
        .sett-input:focus {
          border-color: #18181B;
          box-shadow: 0 0 0 2px rgba(24,24,27,0.06);
        }
      `}</style>

      <div style={{
        minHeight: "100vh",
        background: "#FAFAFA",
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <AppNav />

        <main style={{ maxWidth: "640px", margin: "0 auto", padding: "48px 24px" }}>

          {/* Header */}
          <div style={{ marginBottom: "40px", animation: "settReveal 0.4s ease both" }}>
            <h1 style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "32px", fontWeight: 800,
              color: "#18181B",
              letterSpacing: "-1px",
              margin: "0 0 6px 0",
            }}>
              Settings
            </h1>
            <p style={{ fontSize: "14px", color: "#71717A" }}>
              Manage integrations, API keys, and account preferences.
            </p>
          </div>

          {/* Pipedrive */}
          <section style={{
            background: "#FFFFFF",
            border: "1px solid #E4E4E7",
            borderRadius: "12px",
            padding: "28px",
            marginBottom: "16px",
            animation: "settReveal 0.4s 0.05s ease both",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "16px", fontWeight: 700,
                  color: "#18181B", margin: "0 0 2px 0",
                }}>
                  Pipedrive CRM
                </h2>
                <p style={{ fontSize: "13px", color: "#71717A", margin: 0 }}>
                  Sync won/lost proposals directly into Pipedrive as deals.
                </p>
              </div>
              {pipedriveConnected && (
                <span style={{
                  fontSize: "11px", fontWeight: 600,
                  padding: "4px 10px", borderRadius: "4px",
                  background: "#ECFDF5", color: "#059669",
                  fontFamily: "'Anybody', sans-serif",
                  textTransform: "uppercase", letterSpacing: "0.3px",
                }}>
                  Connected
                </span>
              )}
            </div>

            {pipedriveConnected ? (
              <div style={{
                background: "#ECFDF5",
                border: "1px solid #D1FAE5",
                borderRadius: "6px",
                padding: "12px 14px",
                fontSize: "13px", color: "#065F46",
                marginBottom: "16px",
              }}>
                Pipedrive is connected. To update your API key, enter a new one below.
              </div>
            ) : (
              <div style={{
                background: "#FFFBEB",
                border: "1px solid #FEF3C7",
                borderRadius: "6px",
                padding: "12px 14px",
                fontSize: "13px", color: "#92400E",
                marginBottom: "16px",
              }}>
                Find your API key under <strong>Pipedrive → Account → Personal Preferences → API</strong>.
              </div>
            )}

            <div>
              <label style={{
                display: "block",
                fontFamily: "'Syne', sans-serif",
                fontSize: "12px", fontWeight: 600,
                color: "#52525B",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}>
                API Key
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  type="password"
                  value={pipedriveKey}
                  onChange={(e) => setPipedriveKey(e.target.value)}
                  placeholder="Paste your Pipedrive API token…"
                  className="sett-input"
                  style={{ flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveApiKey()}
                />
                <button
                  onClick={handleSaveApiKey}
                  disabled={!pipedriveKey.trim() || pipedriveStatus === "saving"}
                  style={{
                    padding: "0 18px",
                    borderRadius: "6px",
                    border: "none",
                    background: "#18181B",
                    color: "#FAFAFA",
                    fontSize: "13px", fontWeight: 600,
                    fontFamily: "'Syne', sans-serif",
                    cursor: !pipedriveKey.trim() ? "not-allowed" : "pointer",
                    opacity: !pipedriveKey.trim() ? 0.4 : 1,
                    transition: "all 0.2s",
                    whiteSpace: "nowrap",
                  }}
                  onMouseEnter={e => { if (pipedriveKey.trim()) e.currentTarget.style.background = "#27272A"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "#18181B"; }}
                >
                  {pipedriveStatus === "saving" ? "Verifying…" : "Save"}
                </button>
              </div>
              {pipedriveStatus === "error" && pipedriveError && (
                <p style={{ fontSize: "12px", color: "#DC2626", marginTop: "8px" }}>{pipedriveError}</p>
              )}
              {pipedriveStatus === "connected" && (
                <p style={{ fontSize: "12px", color: "#059669", marginTop: "8px" }}>Pipedrive connected successfully.</p>
              )}
            </div>
          </section>

          {/* HubSpot */}
          <section style={{
            background: "#FFFFFF",
            border: "1px solid #E4E4E7",
            borderRadius: "12px",
            padding: "28px",
            marginBottom: "32px",
            animation: "settReveal 0.4s 0.1s ease both",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
              <div>
                <h2 style={{
                  fontFamily: "'Syne', sans-serif",
                  fontSize: "16px", fontWeight: 700,
                  color: "#18181B", margin: "0 0 2px 0",
                }}>
                  HubSpot CRM
                </h2>
                <p style={{ fontSize: "13px", color: "#71717A", margin: 0 }}>
                  Connect HubSpot via OAuth to log deals automatically.
                </p>
              </div>
              {hubspotStatus?.connected && (
                <span style={{
                  fontSize: "11px", fontWeight: 600,
                  padding: "4px 10px", borderRadius: "4px",
                  background: "#ECFDF5", color: "#059669",
                  fontFamily: "'Anybody', sans-serif",
                  textTransform: "uppercase", letterSpacing: "0.3px",
                }}>
                  Connected
                </span>
              )}
            </div>

            {hubspotStatus === null ? (
              <div style={{
                height: "40px", borderRadius: "6px",
                background: "#F4F4F5",
              }} />
            ) : hubspotStatus.connected ? (
              <div>
                <div style={{
                  background: "#ECFDF5",
                  border: "1px solid #D1FAE5",
                  borderRadius: "6px",
                  padding: "12px 14px",
                  fontSize: "13px", color: "#065F46",
                  marginBottom: "14px",
                }}>
                  HubSpot is connected{hubspotStatus.portal_id ? ` (Portal ${hubspotStatus.portal_id})` : ""}.
                  Proposals sync as deals.
                </div>
                <button
                  onClick={handleHubspotDisconnect}
                  disabled={disconnecting}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "6px",
                    border: "1.5px solid #FECACA",
                    background: "transparent",
                    color: "#DC2626",
                    fontSize: "13px", fontWeight: 500,
                    cursor: disconnecting ? "not-allowed" : "pointer",
                    opacity: disconnecting ? 0.5 : 1,
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#FEF2F2"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect HubSpot"}
                </button>
              </div>
            ) : (
              <div>
                <div style={{
                  background: "#FFFBEB",
                  border: "1px solid #FEF3C7",
                  borderRadius: "6px",
                  padding: "12px 14px",
                  fontSize: "13px", color: "#92400E",
                  marginBottom: "14px",
                }}>
                  Connect HubSpot via OAuth to automatically log proposals as CRM deals.
                </div>
                <a
                  href={`${API_BASE}/crm/hubspot/connect`}
                  style={{
                    display: "inline-block",
                    padding: "10px 20px",
                    borderRadius: "6px",
                    background: "#FF7A59",
                    color: "#fff",
                    fontSize: "13px", fontWeight: 600,
                    fontFamily: "'Syne', sans-serif",
                    textDecoration: "none",
                    transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = "0 4px 16px rgba(255,122,89,0.25)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                >
                  Connect HubSpot →
                </a>
              </div>
            )}
          </section>

          {/* Footer links */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "24px",
            animation: "settReveal 0.4s 0.15s ease both",
          }}>
            <Link href="/dashboard" style={{
              fontSize: "13px", color: "#71717A",
              textDecoration: "none",
              transition: "color 0.2s",
            }}
              onMouseEnter={e => e.currentTarget.style.color = "#18181B"}
              onMouseLeave={e => e.currentTarget.style.color = "#71717A"}
            >
              ← Dashboard
            </Link>
            <span style={{ color: "#D4D4D8" }}>·</span>
            <button
              onClick={signOut}
              style={{
                background: "none", border: "none",
                fontSize: "13px", color: "#A1A1AA",
                cursor: "pointer",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => e.currentTarget.style.color = "#DC2626"}
              onMouseLeave={e => e.currentTarget.style.color = "#A1A1AA"}
            >
              Sign out
            </button>
          </div>
        </main>
      </div>
    </>
  );
}
