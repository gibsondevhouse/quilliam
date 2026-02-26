"use client";

import type { SidebarTab } from "./Sidebar";

interface ActivityBarProps {
  activePanel: SidebarTab | null;
  onPanelChange: (panel: SidebarTab) => void;
  bottomPanelOpen: boolean;
  onToggleBottomPanel: () => void;
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

function ChatIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

const PANELS: { id: SidebarTab; label: string; icon: React.ReactNode }[] = [
  { id: "manuscripts", label: "Explorer", icon: <FilesIcon /> },
  { id: "chats", label: "AI Chat", icon: <ChatIcon /> },
  { id: "characters", label: "Characters", icon: <PersonIcon /> },
  { id: "locations", label: "Locations", icon: <MapPinIcon /> },
  { id: "world", label: "World", icon: <GlobeIcon /> },
];

export function ActivityBar({ activePanel, onPanelChange, bottomPanelOpen, onToggleBottomPanel }: ActivityBarProps) {
  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        {PANELS.map((p) => (
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
          className={`activity-bar-btn ${bottomPanelOpen ? "active" : ""}`}
          onClick={onToggleBottomPanel}
          title="Toggle AI Panel"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="15" x2="21" y2="15" />
          </svg>
        </button>
      </div>
    </div>
  );
}
