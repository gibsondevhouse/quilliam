"use client";

import { useCallback, useEffect, useRef } from "react";
import { useSidebar } from "@/lib/context/SidebarContext";

interface SidebarHeaderProps {
  onNewChat: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

/** Pin icon SVG — filled when active */
function PinIcon({ active }: { active: boolean }) {
  return active ? (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M9.5 1.5 L12.5 4.5 L8.5 8.5 L9 12 L7 10 L2 13 L5 8 L3 6 L6.5 5.5 Z" />
    </svg>
  ) : (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9.5 1.5 L12.5 4.5 L8.5 8.5 L9 12 L7 10 L2 13 L5 8 L3 6 L6.5 5.5 Z" />
    </svg>
  );
}

export function SidebarHeader({
  onNewChat,
  searchQuery,
  onSearchChange,
}: SidebarHeaderProps) {
  const { close, isPinned, pin, unpin } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);

  // ⌘K focuses the search input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handlePinToggle = useCallback(() => {
    if (isPinned) unpin();
    else pin();
  }, [isPinned, pin, unpin]);

  return (
    <div className="oc-sidebar-header">
      {/* Toolbar row: label + buttons */}
      <div className="oc-sidebar-header-toolbar">
        <span className="oc-sidebar-history-label">Chat history</span>

        <div className="oc-sidebar-header-buttons">
          {/* New chat */}
          <button
            className="oc-sidebar-icon-btn"
            onClick={onNewChat}
            title="New chat"
            aria-label="New chat"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 15 15"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7.5 2.5 L7.5 12.5 M2.5 7.5 L12.5 7.5" />
            </svg>
          </button>

          {/* Pin / unpin */}
          <button
            className="oc-sidebar-icon-btn"
            data-active={isPinned ? "true" : "false"}
            onClick={handlePinToggle}
            title={isPinned ? "Unpin sidebar" : "Pin sidebar (push layout)"}
            aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar"}
          >
            <PinIcon active={isPinned} />
          </button>

          {/* Close */}
          <button
            className="oc-sidebar-icon-btn"
            onClick={close}
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 13 13"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <line x1="1" y1="1" x2="12" y2="12" />
              <line x1="12" y1="1" x2="1" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Search row */}
      <div className="oc-sidebar-search-row">
        <input
          ref={searchRef}
          className="oc-sidebar-search"
          type="search"
          placeholder="Search…"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label="Search chats and libraries"
        />
        <span className="oc-sidebar-kbd-hint" aria-hidden>
          ⌘K
        </span>
      </div>

      {/* Global shortcut hint */}
      <div className="oc-sidebar-shortcut-hint" aria-hidden>
        ⇧⌘O to toggle sidebar
      </div>
    </div>
  );
}
