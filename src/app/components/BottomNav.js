"use client";
import { T } from "../designTokens";

const TABS = [
  {
    label: "Vandaag",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M3 10.5L12 4l9 6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 9.5V19a1 1 0 0 0 1 1H17.5a1 1 0 0 0 1-1V9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    label: "Schema",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3.5" y="4.5" width="17" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
        <path d="M3.5 9h17M8 2.5v4M16 2.5v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    label: "Voortgang",
    icon: () => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 15l5-5 4 4 7-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
