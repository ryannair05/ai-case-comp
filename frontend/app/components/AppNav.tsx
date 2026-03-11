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
    <nav style={{
      background: "rgba(11,15,26,0.85)",
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      padding: "0 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      height: "56px",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      {/* Logo */}
      <Link
        href="/dashboard"
        style={{
          fontFamily: "'Outfit', sans-serif",
          fontSize: "20px",
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.5px",
          textDecoration: "none",
          flexShrink: 0,
        }}
      >
        Draftly
      </Link>

      {/* Links */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        overflowX: "auto",
        fontSize: "13px",
      }}>
        {NAV_LINKS.map((link) => {
          if (link.tier === "gtm_agent" && !isGtm) {
            return (
              <span
                key={link.href}
                style={{
                  color: "rgba(148,163,184,0.3)",
                  cursor: "not-allowed",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  whiteSpace: "nowrap",
                  userSelect: "none",
                }}
                title="GTM Agent tier required"
              >
                {link.label}
                <span style={{
                  fontSize: "9px",
                  padding: "1px 5px",
                  borderRadius: "4px",
                  background: "rgba(255,255,255,0.04)",
                  color: "rgba(148,163,184,0.3)",
                  fontWeight: 500,
                }}>GTM</span>
              </span>
            );
          }

          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{
                color: isActive ? "#A5B4FC" : "rgba(226,232,240,0.5)",
                fontWeight: isActive ? 600 : 400,
                textDecoration: "none",
                padding: "6px 10px",
                borderRadius: "6px",
                background: isActive ? "rgba(99,102,241,0.1)" : "transparent",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "rgba(226,232,240,0.8)";
                  e.currentTarget.style.background = "rgba(255,255,255,0.04)";
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = "rgba(226,232,240,0.5)";
                  e.currentTarget.style.background = "transparent";
                }
              }}
            >
              {link.label}
            </Link>
          );
        })}

        <button
          onClick={signOut}
          style={{
            color: "rgba(148,163,184,0.4)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "6px 10px",
            borderRadius: "6px",
            fontSize: "13px",
            fontFamily: "inherit",
            transition: "color 0.2s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => e.currentTarget.style.color = "rgba(248,113,113,0.8)"}
          onMouseLeave={e => e.currentTarget.style.color = "rgba(148,163,184,0.4)"}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
