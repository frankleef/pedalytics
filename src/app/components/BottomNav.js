"use client";
import { T } from "../designTokens";

const TABS = [
  {
    label: "Vandaag",
    icon: (active) => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="3" width="8" height="8" rx="2.5" fill="currentColor" />
        <rect x="13" y="3" width="8" height="8" rx="2.5" fill="currentColor" opacity={active ? 1 : 0.4} />
        <rect x="3" y="13" width="8" height="8" rx="2.5" fill="currentColor" opacity={active ? 0.4 : 0.4} />
        <rect x="13" y="13" width="8" height="8" rx="2.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Sessie",
    icon: () => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4.5" width="17" height="16" rx="3.5" stroke="currentColor" strokeWidth="2" />
        <rect x="3.5" y="4.5" width="17" height="5" rx="2.5" fill="currentColor" />
        <rect x="7" y="2.5" width="2" height="4" rx="1" fill="currentColor" />
        <rect x="15" y="2.5" width="2" height="4" rx="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    label: "Vorm",
    icon: () => (
      <svg width="23" height="23" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="14" width="4" height="7" rx="1.5" fill="currentColor" />
        <rect x="10" y="8" width="4" height="13" rx="1.5" fill="currentColor" opacity="0.6" />
        <rect x="17" y="3" width="4" height="18" rx="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export default function BottomNav({ activeTab, onTabChange }) {
  return (
    <div style={{
      position: "fixed", bottom: 0, left: 0, right: 0, height: T.navH,
      background: T.cardBg, borderTop: `1px solid ${T.divider}`,
      display: "flex", alignItems: "flex-start", justifyContent: "space-around",
      padding: "11px 16px 0", zIndex: 40,
    }}>
      {TABS.map((tab, i) => {
        const active = activeTab === i;
        return (
          <button key={i} onClick={() => onTabChange(i)}
            style={{
              display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer", padding: 0,
              color: active ? T.text : "#9E988C", flex: 1,
            }}>
            {tab.icon(active)}
            <span style={{ font: `${active ? 800 : 700} 10.5px var(--font-nunito), sans-serif` }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
