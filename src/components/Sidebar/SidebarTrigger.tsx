"use client";

import { useSidebar } from "@/lib/context/SidebarContext";

/**
 * Floating button always visible in the top-left corner when the sidebar
 * is closed. Uses `aria-controls` to link it to the sidebar panel.
 */
export function SidebarTrigger() {
  const { isOpen, open } = useSidebar();

  return (
    <button
      className="sidebar-trigger"
      data-hidden={isOpen ? "true" : "false"}
      onClick={open}
      aria-label="Open sidebar"
      aria-expanded={isOpen}
      aria-controls="quilliam-sidebar"
      title="Open sidebar (⇧⌘O)"
    >
      {/* Hamburger / panel icon */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      >
        <line x1="2" y1="5" x2="16" y2="5" />
        <line x1="2" y1="9" x2="16" y2="9" />
        <line x1="2" y1="13" x2="16" y2="13" />
      </svg>
    </button>
  );
}
