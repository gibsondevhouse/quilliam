"use client";

import {
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import type { SidebarNode } from "@/lib/navigation";
import type { PersistedGeneralThread } from "@/lib/rag/store";
import type { ThreadBuckets } from "@/lib/landing/useGeneralThreads";
import type { LoRA } from "@/lib/landing/loras";
import { useSidebar, type SidebarSection } from "@/lib/context/SidebarContext";
import { LibrariesSection } from "./LibrariesSection";

// Re-export ThreadRow-style rendering inline to keep this self-contained.
// (Heavy HomeSidebar logic remains in HomeSidebar for reverse-compatibility.)
interface ThreadRowMinimalProps {
  title: string;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ThreadRowMinimal({ title, isActive, onSelect, onDelete }: ThreadRowMinimalProps) {
  return (
    <div
      className={`thread-row${isActive ? " thread-row--active" : ""}`}
      onClick={onSelect}
      style={{ display: "flex", alignItems: "center", gap: 6 }}
    >
      <span className="thread-row-title" style={{ flex: 1, minWidth: 0 }}>
        {title}
      </span>
      <button
        className="thread-action-btn thread-action-btn--delete"
        title="Delete"
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        aria-label={`Delete chat ${title}`}
      >
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface SidebarSectionsProps {
  // Libraries
  libraries: SidebarNode[];
  activeLibraryId: string | null;
  onNewLibrary: () => void;
  onDeleteLibrary: (id: string) => void;
  onRenameLibrary: (id: string) => void;

  // Chats
  threads: PersistedGeneralThread[];
  threadBuckets: ThreadBuckets;
  activeChatId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;

  // Templates (LoRAs)
  loras: LoRA[];
  activeLoRAId: string;
  onSelectLoRA: (id: string) => void;

  // Shared
  searchQuery: string;
}

// Section tab label map
const SECTION_TABS: { key: SidebarSection; label: string }[] = [
  { key: "libraries", label: "Libraries" },
  { key: "chats", label: "Your chats" },
  { key: "templates", label: "Templates" },
];

// ---------------------------------------------------------------------------
// SidebarSections
// ---------------------------------------------------------------------------

export function SidebarSections({
  libraries,
  activeLibraryId,
  onNewLibrary,
  onDeleteLibrary,
  onRenameLibrary,
  threads,
  threadBuckets,
  activeChatId,
  onSelectThread,
  onDeleteThread,
  // onRenameThread is available for future inline rename — unused in this view
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRenameThread,
  loras,
  activeLoRAId,
  onSelectLoRA,
  searchQuery,
}: SidebarSectionsProps) {
  const { activeSection, setSection } = useSidebar();

  // Persist scroll positions per section so they survive section switches
  // without unmounting the panels.
  const scrollRefs = useRef<Record<SidebarSection, number>>({
    libraries: 0,
    chats: 0,
    templates: 0,
  });
  const bodyRef = useRef<HTMLDivElement>(null);

  // Save scroll on section change, restore on switch
  const prevSection = useRef<SidebarSection>(activeSection);
  useLayoutEffect(() => {
    if (bodyRef.current && prevSection.current !== activeSection) {
      // Save departing section scrollTop
      scrollRefs.current[prevSection.current] = bodyRef.current.scrollTop;
      prevSection.current = activeSection;
    }
    // Restore incoming section scrollTop
    if (bodyRef.current) {
      bodyRef.current.scrollTop = scrollRefs.current[activeSection];
    }
  }, [activeSection]);

  const handleSetSection = useCallback(
    (s: SidebarSection) => {
      if (bodyRef.current) {
        scrollRefs.current[activeSection] = bodyRef.current.scrollTop;
      }
      setSection(s);
    },
    [activeSection, setSection],
  );

  // Filtered threads for search
  const filteredThreads = searchQuery
    ? threads.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.preview ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  return (
    <>
      {/* Section tabs */}
      <div className="oc-sidebar-sections-bar" role="tablist" aria-label="Sidebar sections">
        {SECTION_TABS.map((tab) => (
          <button
            key={tab.key}
            className="oc-sidebar-section-tab"
            data-active={activeSection === tab.key ? "true" : "false"}
            onClick={() => handleSetSection(tab.key)}
            role="tab"
            aria-selected={activeSection === tab.key}
            aria-controls={`oc-section-${tab.key}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable body — single div, panels hidden via CSS not unmount */}
      <div ref={bodyRef} className="oc-sidebar-body">
        {/* ── Libraries panel ── */}
        <div
          id="oc-section-libraries"
          className="oc-sidebar-panel"
          data-hidden={activeSection !== "libraries" ? "true" : "false"}
          role="tabpanel"
          aria-labelledby="oc-tab-libraries"
        >
          <LibrariesSection
            libraries={libraries}
            activeLibraryId={activeLibraryId}
            searchQuery={searchQuery}
            onNewLibrary={onNewLibrary}
            onDeleteLibrary={onDeleteLibrary}
            onRenameLibrary={onRenameLibrary}
          />
        </div>

        {/* ── Chats panel ── */}
        <div
          id="oc-section-chats"
          className="oc-sidebar-panel"
          data-hidden={activeSection !== "chats" ? "true" : "false"}
          role="tabpanel"
          aria-labelledby="oc-tab-chats"
        >
          {searchQuery ? (
            filteredThreads!.length === 0 ? (
              <p className="oc-sidebar-empty">
                No chats match &ldquo;{searchQuery}&rdquo;
              </p>
            ) : (
              filteredThreads!.map((t) => (
                <ThreadRowMinimal
                  key={t.id}
                  title={t.title}
                  isActive={t.id === activeChatId}
                  onSelect={() => onSelectThread(t.id)}
                  onDelete={() => onDeleteThread(t.id)}
                />
              ))
            )
          ) : (
            <>
              {renderBucket("Today", threadBuckets.today, activeChatId, onSelectThread, onDeleteThread)}
              {renderBucket("Yesterday", threadBuckets.yesterday, activeChatId, onSelectThread, onDeleteThread)}
              {renderBucket("Previous 7 days", threadBuckets.last7days, activeChatId, onSelectThread, onDeleteThread)}
              {renderBucket("Older", threadBuckets.older, activeChatId, onSelectThread, onDeleteThread)}
              {threads.length === 0 && (
                <p className="oc-sidebar-empty">
                  No chats yet. Click + New Chat to begin.
                </p>
              )}
            </>
          )}
        </div>

        {/* ── Templates (LoRAs) panel ── */}
        <div
          id="oc-section-templates"
          className="oc-sidebar-panel"
          data-hidden={activeSection !== "templates" ? "true" : "false"}
          role="tabpanel"
          aria-labelledby="oc-tab-templates"
        >
          {loras.length === 0 ? (
            <p className="oc-sidebar-empty">No templates yet.</p>
          ) : (
            loras.map((lora) => (
              <div
                key={lora.id}
                className={`lora-row${lora.id === activeLoRAId ? " lora-row--active" : ""}`}
                onClick={() => onSelectLoRA(lora.id)}
                role="button"
                tabIndex={0}
                aria-label={`Select template ${lora.name}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") onSelectLoRA(lora.id);
                }}
              >
                <div className="lora-row-name">{lora.name}</div>
                {lora.description && (
                  <div className="lora-row-desc">{lora.description}</div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function renderBucket(
  label: string,
  threads: PersistedGeneralThread[],
  activeChatId: string | null,
  onSelect: (id: string) => void,
  onDelete: (id: string) => void,
) {
  if (threads.length === 0) return null;
  return (
    <div key={label}>
      <div className="oc-section-bucket-label">{label}</div>
      {threads.map((t) => (
        <ThreadRowMinimal
          key={t.id}
          title={t.title}
          isActive={t.id === activeChatId}
          onSelect={() => onSelect(t.id)}
          onDelete={() => onDelete(t.id)}
        />
      ))}
    </div>
  );
}
