"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";

interface NavLink {
  href: string;
  label: string;
  tier?: "gtm_agent";
}

const NAV_LINKS: NavLink[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/proposals/new", label: "New Proposal" },
  { href: "/moat-meter", label: "Moat Meter" },
  { href: "/onboarding", label: "Upload" },
  { href: "/billing", label: "Billing" },
  { href: "/support", label: "Support" },
  { href: "/settings", label: "Settings" },
  { href: "/gtm/meeting-signals", label: "Signals", tier: "gtm_agent" },
  { href: "/gtm/outreach", label: "Outreach", tier: "gtm_agent" },
  { href: "/gtm", label: "Pipeline", tier: "gtm_agent" },
];

export default function AppNav() {
  const { user, signOut } = useAuth();
  const pathname = usePathname();
  const isGtm = user?.tier === "gtm_agent";

  return (
    <>
      {/* Spacer to prevent content overlap since the nav is floating/fixed */}
      <div style={{ height: "96px" }} />

      <div style={{
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 100,
        width: "calc(100% - 32px)",
        maxWidth: "1200px",
      }}>
        <nav style={{
          background: "rgba(10, 11, 14, 0.75)",
          backdropFilter: "blur(24px) saturate(180%)",
          WebkitBackdropFilter: "blur(24px) saturate(180%)",
          border: "1px solid rgba(255, 255, 255, 0.08)",
          borderRadius: "24px",
          padding: "8px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
          boxShadow: "0 8px 32px -8px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02)",
          gap: "20px",
        }}>
          {/* Logo Section */}
          <div style={{ display: "flex", alignItems: "center", gap: "20px", flexShrink: 0 }}>
            <Link
              href="/dashboard"
              style={{
                fontFamily: "'Fraunces', serif",
                fontSize: "22px",
                fontWeight: 600,
                color: "#fff",
                letterSpacing: "-0.02em",
                textDecoration: "none",
                background: "linear-gradient(to right, #fff, #a5b4fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                transition: "opacity 0.2s",
              }}
            >
              Draftly
            </Link>

            <div style={{
              width: "1px",
              height: "24px",
              background: "rgba(255, 255, 255, 0.1)",
            }} />
          </div>

          {/* Links Section */}
          <div
            className="no-scrollbar"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              overflowX: "auto",
              flex: 1,
              padding: "4px 0",
            }}
          >
            {NAV_LINKS.map((link) => {
              const isRestricted = link.tier === "gtm_agent" && !isGtm;
              const isActive = pathname === link.href || pathname.startsWith(link.href + "/");

              if (isRestricted) {
                return (
                  <div
                    key={link.href}
                    style={{
                      color: "rgba(148,163,184,0.3)",
                      padding: "8px 12px",
                      borderRadius: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      whiteSpace: "nowrap",
                      cursor: "not-allowed",
                      fontSize: "13px",
                      fontFamily: "'Outfit', sans-serif",
                      fontWeight: 500,
                      flexShrink: 0,
                    }}
                    title="GTM Agent tier required"
                  >
                    {link.label}
                    <span style={{
                      fontSize: "10px",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      background: "rgba(255,255,255,0.03)",
                      color: "rgba(148,163,184,0.2)",
                      border: "1px solid rgba(255,255,255,0.05)",
                    }}>GTM</span>
                  </div>
                );
              }

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  style={{
                    color: isActive ? "#fff" : "rgba(226,232,240,0.45)",
                    fontSize: "13px",
                    fontWeight: isActive ? 600 : 500,
                    textDecoration: "none",
                    padding: "8px 14px",
                    borderRadius: "12px",
                    background: isActive ? "rgba(255, 255, 255, 0.05)" : "transparent",
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    whiteSpace: "nowrap",
                    fontFamily: "'Outfit', sans-serif",
                    border: isActive ? "1px solid rgba(255,255,255,0.1)" : "1px solid transparent",
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(255, 255, 255, 0.8)";
                      e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)";
                    }
                  }}
                  onMouseLeave={e => {
                    if (!isActive) {
                      e.currentTarget.style.color = "rgba(226,232,240,0.45)";
                      e.currentTarget.style.background = "transparent";
                    }
                  }}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>

          {/* Action Section */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexShrink: 0 }}>
            <button
              onClick={signOut}
              style={{
                padding: "8px 16px",
                borderRadius: "12px",
                fontSize: "13px",
                fontWeight: 600,
                fontFamily: "'Outfit', sans-serif",
                background: "transparent",
                color: "rgba(255, 71, 71, 0.7)",
                border: "1px solid rgba(255, 71, 71, 0.15)",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(255, 71, 71, 0.08)";
                e.currentTarget.style.color = "rgba(255, 71, 71, 1)";
                e.currentTarget.style.borderColor = "rgba(255, 71, 71, 0.3)";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255, 71, 71, 0.7)";
                e.currentTarget.style.borderColor = "rgba(255, 71, 71, 0.15)";
              }}
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* Visual Accent - subtle glow below the bar */}
        <div style={{
          position: "absolute",
          bottom: "-1px",
          left: "10%",
          right: "10%",
          height: "1px",
          background: "linear-gradient(90deg, transparent, rgba(165, 180, 252, 0.3), transparent)",
          filter: "blur(4px)",
          pointerEvents: "none",
        }} />
      </div>
    </>
  );
}
