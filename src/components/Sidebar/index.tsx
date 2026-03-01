"use client";

import { useEffect, useRef, useState } from "react";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useSidebarData } from "@/lib/context/SidebarDataContext";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { SidebarHeader } from "./SidebarHeader";
import { DomainNavAccordion } from "./DomainNavAccordion";
import { SidebarSections } from "./SidebarSections";
import { SidebarFooter } from "./SidebarFooter";

// ---------------------------------------------------------------------------
// Stable fallbacks
// ---------------------------------------------------------------------------

const EMPTY_THREADS: never[] = [];
const EMPTY_BUCKETS = { pinned: [], today: [], yesterday: [], last7days: [], older: [] };
const noop = () => {};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OffCanvasSidebar() {
  const { isOpen, isPinned, close } = useSidebar();
  const pageData = useSidebarData();

  const sidebarRef = useRef<HTMLElement | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Focus trap — active when sidebar is open and NOT pinned (overlay mode only)
  useFocusTrap(sidebarRef, isOpen && !isPinned);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [isOpen, close]);

  // Resolve last-used library id for nav links
  // (DomainNavAccordion reads this itself via useSidebarData + localStorage)

  // Unpack context data with stable fallbacks
  const threads = pageData?.threads ?? EMPTY_THREADS;
  const threadBuckets = pageData?.threadBuckets ?? EMPTY_BUCKETS;
  const activeChatId = pageData?.activeChatId ?? null;
  const onNewChat = pageData?.onNewChat ?? noop;
  const onSelectThread = pageData?.onSelectThread ?? noop;
  const onDeleteThread = pageData?.onDeleteThread ?? noop;
  const onRenameThread = pageData?.onRenameThread ?? noop;

  return (
    <nav
      ref={sidebarRef}
      id="quilliam-sidebar"
      className="off-canvas-sidebar"
      data-open={isOpen ? "true" : "false"}
      aria-hidden={!isOpen}
      aria-label="Application sidebar"
    >
      {/* 1. Header: close / pin / new-chat / search */}
      <SidebarHeader
        onNewChat={onNewChat}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      {/* 2. Domain nav accordion */}
      <DomainNavAccordion />

      {/* 3. Chats section */}
      <SidebarSections
        threads={threads}
        threadBuckets={threadBuckets}
        activeChatId={activeChatId}
        onSelectThread={onSelectThread}
        onDeleteThread={onDeleteThread}
        onRenameThread={onRenameThread}
        searchQuery={searchQuery}
      />

      {/* 4. Footer: avatar + plan badge */}
      <SidebarFooter />
    </nav>
  );
}

