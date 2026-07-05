"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "../designTokens";

const ICONS = {
  observability: <path d="M3 12h4l2 6 4-14 2 8h6" />,
  sessietypes: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M3 13l9 5 9-5" /></>,
  jobs: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  debug: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></>,
};

function NavIcon({ naam, actief }) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={actief ? "#f7f3eb" : "oklch(0.55 0.012 74)"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {ICONS[naam]}
    </svg>
  );
}

const NAV = [
  { groep: "ANALYSE", items: [
    { href: "/admin", label: "Observability", icoon: "observability", exact: true },
  ] },
  { groep: "CONFIGURATIE", items: [
    { href: "/admin/archetypes", label: "Sessietypes", icoon: "sessietypes" },
  ] },
  { groep: "SYSTEEM", items: [
    { href: "/admin/jobs", label: "Jobs & cron", icoon: "jobs" },
    { href: "/admin/debug", label: "Debug", icoon: "debug" },
  ] },
];

function topbarInfo(pathname) {
  if (pathname.startsWith("/admin/archetypes/nieuw")) return { sectie: "Configuratie", titel: "Nieuw archetype" };
  if (pathname.startsWith("/admin/archetypes/") && pathname.endsWith("/bewerken")) return { sectie: "Configuratie", titel: "Archetype bewerken" };
  if (pathname.startsWith("/admin/archetypes")) return { sectie: "Configuratie", titel: "Sessie-archetypes" };
  if (pathname.startsWith("/admin/jobs")) return { sectie: "Systeem", titel: "Jobs & cron" };
  if (pathname.startsWith("/admin/debug")) return { sectie: "Systeem", titel: "Debug" };
  return { sectie: "Analyse", titel: "Observability" };
}

export default function AdminShell({ children, gebruiker }) {
  const pathname = usePathname();
  const { sectie, titel } = topbarInfo(pathname);
  const naam = gebruiker?.name || gebruiker?.email || "Beheerder";
  const initiaal = naam.charAt(0).toUpperCase();

  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex" }}>
      <aside style={{ width: 246, flex: "none", background: "oklch(0.975 0.006 88)", borderRight: `1px solid ${T.cardBorder}`, display: "flex", flexDirection: "column", padding: "22px 16px", position: "sticky", top: 0, height: "100vh", overflowY: "auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "4px 8px 22px" }}>
          <svg viewBox="0 0 100 100" width="34" height="34" style={{ borderRadius: 9 }}>
            <rect width="100" height="100" rx="23" fill="#33302a" />
            <path d="M40.5 30.9 A25 25 0 1 0 66.2 38.9" fill="none" stroke="#f7f3eb" strokeWidth="9.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M66.2 38.9 C74 33 80.5 25.5 84.5 16.5" fill="none" stroke="#79b492" strokeWidth="9.5" strokeLinecap="round" />
            <circle cx="84.5" cy="16.5" r="6.2" fill="#79b492" />
          </svg>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <span style={{ font: "800 16px var(--font-nunito), sans-serif", letterSpacing: -0.4, color: "oklch(0.3 0.012 66)" }}>Kesto</span>
            <span style={{ font: "700 9.5px var(--font-nunito), sans-serif", letterSpacing: 1.5, color: "oklch(0.63 0.06 150)" }}>ADMIN</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1 }}>
          {NAV.map(({ groep, items }) => (
            <div key={groep}>
              <span style={{ font: "700 10px var(--font-nunito), sans-serif", letterSpacing: 1.4, color: "oklch(0.66 0.012 78)", padding: "14px 10px 6px", display: "block" }}>{groep}</span>
              {items.map(({ href, label, icoon, exact }) => {
                const actief = exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href} style={{
                    display: "flex", alignItems: "center", gap: 11, padding: "9px 11px", borderRadius: 11,
                    background: actief ? T.slate : "transparent", textDecoration: "none",
                  }}>
                    <NavIcon naam={icoon} actief={actief} />
                    <span style={{ font: actief ? "700 13.5px var(--font-nunito), sans-serif" : "600 13.5px var(--font-nunito), sans-serif", color: actief ? "#f7f3eb" : "oklch(0.5 0.012 74)" }}>{label}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 11px", borderTop: `1px solid ${T.cardBorder}`, marginTop: 8 }}>
          <div style={{ width: 32, height: 32, flex: "none", borderRadius: "50%", background: T.slate, display: "flex", alignItems: "center", justifyContent: "center", font: "800 13px var(--font-nunito), sans-serif", color: "#f7f3eb" }}>{initiaal}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1, overflow: "hidden" }}>
            <span style={{ font: "700 12.5px var(--font-nunito), sans-serif", color: "oklch(0.36 0.012 68)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{naam}</span>
            <span style={{ font: "600 11px var(--font-nunito), sans-serif", color: "oklch(0.62 0.012 76)", whiteSpace: "nowrap" }}>Beheerder</span>
          </div>
        </div>
      </aside>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", background: T.bg, minWidth: 0 }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "20px 30px", borderBottom: `1px solid ${T.cardBorder}`, background: T.cardBg }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, font: "600 11.5px var(--font-nunito), sans-serif", color: "oklch(0.63 0.012 76)" }}>
              <span>{sectie}</span><span style={{ color: "oklch(0.78 0.01 78)" }}>/</span><span style={{ color: "oklch(0.5 0.012 74)" }}>{titel}</span>
            </div>
            <h1 style={{ margin: 0, font: "800 23px var(--font-nunito), sans-serif", letterSpacing: -0.5, color: "oklch(0.3 0.012 66)" }}>{titel}</h1>
          </div>
          <Link href="/" style={{
            font: "700 12.5px var(--font-nunito), sans-serif", color: T.textSec, border: `1.5px solid ${T.cardBorder}`,
            padding: "8px 14px", borderRadius: T.pillRadius, textDecoration: "none",
          }}>
            ← Terug naar app
          </Link>
        </header>
        <div style={{ flex: 1, minWidth: 0 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
