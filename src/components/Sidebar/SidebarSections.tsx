"use client";

import {
  useRef,
} from "react";
import type { PersistedGeneralThread } from "@/lib/rag/store";
import type { ThreadBuckets } from "@/lib/landing/useGeneralThreads";

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
  threads: PersistedGeneralThread[];
  threadBuckets: ThreadBuckets;
  activeChatId: string | null;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  searchQuery: string;
}

// ---------------------------------------------------------------------------
// SidebarSections — Chats only
// ---------------------------------------------------------------------------

export function SidebarSections({
  threads,
  threadBuckets,
  activeChatId,
  onSelectThread,
  onDeleteThread,
  // onRenameThread available for future inline rename
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onRenameThread,
  searchQuery,
}: SidebarSectionsProps) {
  const bodyRef = useRef<HTMLDivElement>(null);

  const filteredThreads = searchQuery
    ? threads.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.preview ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;

  return (
    <div ref={bodyRef} className="oc-sidebar-body">
      {/* Section heading */}
      <div className="oc-section-heading">Recent chats</div>

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
