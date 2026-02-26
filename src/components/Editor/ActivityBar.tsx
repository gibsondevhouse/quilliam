"use client";

import type { SidebarTab } from "./Sidebar";

interface ActivityBarProps {
  activePanel: SidebarTab | null;
  onPanelChange: (panel: SidebarTab) => void;
}

/* Minimalist SVG icons — Feather-style, 22×22 */

function FilesIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
      <polyline points="13 2 13 9 20 9" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

const GLOBAL_PANELS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "manuscripts", label: "Explorer", icon: <FilesIcon /> },
];

export function ActivityBar({ activePanel, onPanelChange }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {GLOBAL_PANELS.map((p) => (
          <button
            key={p.id}
            className={`activity-bar-btn ${activePanel === p.id ? "active" : ""}`}
            onClick={() => onPanelChange(p.id)}
            title={p.label}
          >
            {p.icon}
          </button>
        ))}
      </div>
      <div className="activity-bar-bottom">
        <button
          className="activity-bar-btn"
          title="Settings (coming soon)"
          disabled
        >
          <SettingsIcon />
        </button>
      </div>
    </div>
  );
}

