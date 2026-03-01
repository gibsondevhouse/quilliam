"use client";

import { useEffect, useRef, useState } from "react";
import type { SidebarNode } from "@/lib/navigation";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useSidebarData } from "@/lib/context/SidebarDataContext";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { SidebarHeader } from "./SidebarHeader";
import { SidebarNavLinks } from "./SidebarNavLinks";
import { SidebarSections } from "./SidebarSections";
import { SidebarFooter } from "./SidebarFooter";

// ---------------------------------------------------------------------------
// Props — minimal set; thread/lora data flows in via SidebarDataContext
// ---------------------------------------------------------------------------

export interface OffCanvasSidebarProps {
  libraries: SidebarNode[];
  activeLibraryId: string | null;
  onNewLibrary: () => void;
  onDeleteLibrary: (id: string) => void;
  onRenameLibrary: (id: string) => void;
}

// Stable empty fallbacks so SidebarSections never receives undefined
const EMPTY_THREADS: never[] = [];
const EMPTY_LORAS: never[] = [];
const EMPTY_BUCKETS = { pinned: [], today: [], yesterday: [], last7days: [], older: [] };
const noop = () => {};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OffCanvasSidebar({
  libraries,
  activeLibraryId,
  onNewLibrary,
  onDeleteLibrary,
  onRenameLibrary,
}: OffCanvasSidebarProps) {
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
  const lastLibraryId =
    activeLibraryId ??
    (typeof window !== "undefined"
      ? localStorage.getItem("quilliam_last_library")
      : null);

  // Unpack context data with stable fallbacks
  const threads = pageData?.threads ?? EMPTY_THREADS;
  const threadBuckets = pageData?.threadBuckets ?? EMPTY_BUCKETS;
  const activeChatId = pageData?.activeChatId ?? null;
  const loras = pageData?.loras ?? EMPTY_LORAS;
  const activeLoRAId = pageData?.activeLoRAId ?? "";
  const onNewChat = pageData?.onNewChat ?? noop;
  const onSelectThread = pageData?.onSelectThread ?? noop;
  const onDeleteThread = pageData?.onDeleteThread ?? noop;
  const onRenameThread = pageData?.onRenameThread ?? noop;
  const onSelectLoRA = pageData?.onSelectLoRA ?? noop;

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

      {/* 2. Primary nav links */}
      <SidebarNavLinks lastLibraryId={lastLibraryId} />

      {/* 3. Sections: Libraries | Your chats | Templates */}
      <SidebarSections
        libraries={libraries}
        activeLibraryId={activeLibraryId}
        onNewLibrary={onNewLibrary}
        onDeleteLibrary={onDeleteLibrary}
        onRenameLibrary={onRenameLibrary}
        threads={threads}
        threadBuckets={threadBuckets}
        activeChatId={activeChatId}
        onSelectThread={onSelectThread}
        onDeleteThread={onDeleteThread}
        loras={loras}
        activeLoRAId={activeLoRAId}
        onSelectLoRA={onSelectLoRA}
        searchQuery={searchQuery}
        onRenameThread={onRenameThread}
      />

      {/* 4. Footer: avatar + plan badge */}
      <SidebarFooter />
    </nav>
  );
}

