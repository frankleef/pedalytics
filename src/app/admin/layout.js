"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { T } from "../designTokens";

const LINKS = [
  { href: "/admin", label: "Observability" },
  { href: "/admin/archetypes", label: "Sessietypes" },
];

export default function AdminLayout({ children }) {
  const pathname = usePathname();

  return (
    <div style={{ minHeight: "100vh", background: T.bg }}>
      <div style={{ borderBottom: `1px solid ${T.cardBorder}`, background: T.cardBg }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6 }}>
            {LINKS.map(({ href, label }) => {
              const actief = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
              return (
                <Link key={href} href={href} style={{
                  font: "800 13px var(--font-nunito), sans-serif",
                  color: actief ? T.cardBg : T.textSec,
                  background: actief ? T.slate : "transparent",
                  padding: "8px 14px",
                  borderRadius: T.pillRadius,
                  textDecoration: "none",
                }}>
                  {label}
                </Link>
              );
            })}
          </div>
          <Link href="/" style={{
            font: "800 13px var(--font-nunito), sans-serif",
            color: T.textSec,
            border: `1.5px solid ${T.cardBorder}`,
            padding: "8px 14px",
            borderRadius: T.pillRadius,
            textDecoration: "none",
          }}>
            ← Terug naar app
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
