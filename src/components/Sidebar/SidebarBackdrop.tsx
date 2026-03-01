"use client";

import { useSidebar } from "@/lib/context/SidebarContext";

/**
 * Semi-transparent backdrop shown when the sidebar is open in overlay mode
 * (i.e., not pinned, or always on mobile). Clicking it closes the sidebar.
 */
export function SidebarBackdrop() {
  const { isOpen, isPinned, close } = useSidebar();

  // On desktop-pinned, backdrop is invisible but kept in DOM so the CSS
  // transition works correctly for the pin→unpin animation.
  const visible = isOpen && !isPinned;

  return (
    <div
      className="sidebar-backdrop"
      data-visible={visible ? "true" : "false"}
      onClick={close}
      aria-hidden="true"
    />
  );
}
