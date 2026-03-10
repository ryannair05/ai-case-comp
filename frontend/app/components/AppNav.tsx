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
    <nav
      className="bg-white border-b px-6 py-3 flex items-center justify-between"
      style={{ borderColor: "var(--vellum-border)" }}
    >
      {/* Logo */}
      <Link
        href="/dashboard"
        className="text-xl font-bold shrink-0"
        style={{ fontFamily: "Fraunces, Georgia, serif", color: "var(--ink-primary)" }}
      >
        Draftly
      </Link>

      {/* Links */}
      <div className="flex items-center gap-5 text-sm overflow-x-auto">
        {NAV_LINKS.map((link) => {
          if (link.tier === "gtm_agent" && !isGtm) {
            return (
              <span
                key={link.href}
                className="text-slate-400 cursor-not-allowed select-none flex items-center gap-1"
                title="GTM Agent tier required"
              >
                {link.label}
                <span className="text-xs bg-slate-100 text-slate-400 px-1 rounded">GTM</span>
              </span>
            );
          }

          const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
          return (
            <Link
              key={link.href}
              href={link.href}
              className="transition-colors whitespace-nowrap"
              style={{
                color: isActive ? "var(--indigo)" : "var(--ink-secondary)",
                fontWeight: isActive ? 600 : 400,
              }}
            >
              {link.label}
            </Link>
          );
        })}

        <button
          onClick={signOut}
          className="transition-colors whitespace-nowrap"
          style={{ color: "var(--ink-muted)" }}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
