"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SidebarNode } from "@/lib/navigation";
import type { PersistedGeneralThread } from "@/lib/rag/store";
import type { ThreadBuckets } from "@/lib/landing/useGeneralThreads";
import type { LoRA } from "@/lib/landing/loras";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface HomeSidebarProps {
  libraries: SidebarNode[];
  threads: PersistedGeneralThread[];
  threadBuckets: ThreadBuckets;
  activeChatId: string | null;
  contextType: "general" | "library";
  activeLibraryId: string | null;
  loras: LoRA[];
  activeLoRAId: string;
  onNewChat: () => void;
  onSelectThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onPinThread: (id: string) => void;
  onSetContext: (type: "general" | "library", libraryId?: string) => void;
  onSelectLoRA: (id: string) => void;
  onCreateLoRA: (draft: Omit<LoRA, "id" | "createdAt" | "updatedAt">) => void;
  onNewLibrary: () => void;
}

type PrimaryTab = "chats" | "loras";

// ---------------------------------------------------------------------------
// Thread row with hover actions + inline rename
// ---------------------------------------------------------------------------

interface ThreadRowProps {
  thread: PersistedGeneralThread;
  isActive: boolean;
  libraryName?: string;
  onSelect: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onPin: () => void;
}

function ThreadRow({
  thread,
  isActive,
  libraryName,
  onSelect,
  onRename,
  onDelete,
  onPin,
}: ThreadRowProps) {
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(thread.title);
  const inputRef = useRef<HTMLInputElement>(null);

  const startRename = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setRenameVal(thread.title);
      setRenaming(true);
      setTimeout(() => inputRef.current?.select(), 0);
    },
    [thread.title],
  );

  const commitRename = useCallback(() => {
    const v = renameVal.trim();
    if (v && v !== thread.title) onRename(v);
    setRenaming(false);
  }, [renameVal, thread.title, onRename]);

  const badge =
    thread.contextType === "library"
      ? (libraryName ?? "Library")
      : null;

  return (
    <div
      className={[
        "thread-row",
        isActive ? "thread-row--active" : "",
        thread.pinned ? "thread-row--pinned" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={!renaming ? onSelect : undefined}
    >
      {renaming ? (
        <input
          ref={inputRef}
          className="thread-row-rename-input"
          value={renameVal}
          onChange={(e) => setRenameVal(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          onClick={(e) => e.stopPropagation()}
          autoFocus
        />
      ) : (
        <>
          <span className="thread-row-title">{thread.title}</span>
          {badge && <span className="thread-row-badge">{badge}</span>}
          <span className="thread-row-actions" onClick={(e) => e.stopPropagation()}>
            <button
              className="thread-action-btn"
              title="Rename"
              onClick={startRename}
              aria-label="Rename thread"
            >
              ✎
            </button>
            <button
              className="thread-action-btn"
              title={thread.pinned ? "Unpin" : "Pin"}
              onClick={(e) => { e.stopPropagation(); onPin(); }}
              aria-label={thread.pinned ? "Unpin thread" : "Pin thread"}
            >
              {thread.pinned ? "◉" : "○"}
            </button>
            <button
              className="thread-action-btn thread-action-btn--delete"
              title="Delete"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete thread"
            >
              ✕
            </button>
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread bucket section
// ---------------------------------------------------------------------------

interface BucketSectionProps {
  label: string;
  threads: PersistedGeneralThread[];
  activeChatId: string | null;
  getLibraryName: (id?: string) => string | undefined;
  onSelectThread: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onDeleteThread: (id: string) => void;
  onPinThread: (id: string) => void;
}

function BucketSection({
  label,
  threads,
  activeChatId,
  getLibraryName,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onPinThread,
}: BucketSectionProps) {
  if (threads.length === 0) return null;
  return (
    <>
      <div className="thread-bucket-label">{label}</div>
      {threads.map((t) => (
        <ThreadRow
          key={t.id}
          thread={t}
          isActive={t.id === activeChatId}
          libraryName={getLibraryName(t.libraryId)}
          onSelect={() => onSelectThread(t.id)}
          onRename={(title) => onRenameThread(t.id, title)}
          onDelete={() => onDeleteThread(t.id)}
          onPin={() => onPinThread(t.id)}
        />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Create LoRA form
// ---------------------------------------------------------------------------

interface CreateLoRAFormProps {
  onSubmit: (draft: Omit<LoRA, "id" | "createdAt" | "updatedAt">) => void;
  onCancel: () => void;
}

function CreateLoRAForm({ onSubmit, onCancel }: CreateLoRAFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [advanced, setAdvanced] = useState(false);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!name.trim()) return;
      onSubmit({ name: name.trim(), description: description.trim(), systemPrompt: systemPrompt.trim() });
    },
    [name, description, systemPrompt, onSubmit],
  );

  return (
    <form className="create-lora-form" onSubmit={handleSubmit}>
      <div className="create-lora-field">
        <label className="create-lora-label">Name</label>
        <input
          className="create-lora-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="My writing style"
          autoFocus
        />
      </div>
      <div className="create-lora-field">
        <label className="create-lora-label">Description</label>
        <input
          className="create-lora-input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Short description"
        />
      </div>
      <div className="create-lora-field">
        <label className="create-lora-label">System Prompt</label>
        <textarea
          className="create-lora-textarea"
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a writing assistant that..."
          rows={4}
        />
      </div>
      <div className="create-lora-advanced-toggle">
        <button
          type="button"
          className="create-lora-advanced-btn"
          onClick={() => setAdvanced((v) => !v)}
        >
          {advanced ? "▲" : "▶"} Advanced
        </button>
      </div>
      {advanced && (
        <div className="create-lora-advanced">
          <p className="create-lora-stub-note">
            Model override and tool toggles — coming soon.
          </p>
        </div>
      )}
      <div className="create-lora-actions">
        <button type="submit" className="create-lora-submit" disabled={!name.trim()}>
          Create LoRA
        </button>
        <button type="button" className="create-lora-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main HomeSidebar
// ---------------------------------------------------------------------------

export function HomeSidebar({
  libraries,
  threads,
  threadBuckets,
  activeChatId,
  contextType,
  activeLibraryId,
  loras,
  activeLoRAId,
  onNewChat,
  onSelectThread,
  onRenameThread,
  onDeleteThread,
  onPinThread,
  onSetContext,
  onSelectLoRA,
  onCreateLoRA,
  onNewLibrary,
}: HomeSidebarProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PrimaryTab>("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [librariesExpanded, setLibrariesExpanded] = useState(true);
  const [showCreateLoRA, setShowCreateLoRA] = useState(false);

  // Build library id → name lookup
  const libraryNameMap: Record<string, string> = {};
  for (const lib of libraries) {
    libraryNameMap[lib.id] = lib.title;
  }
  const getLibraryName = useCallback(
    (id?: string) => (id ? libraryNameMap[id] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [libraries],
  );

  // Search filtering
  const filteredThreads = searchQuery
    ? threads.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (t.preview ?? "").toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : null;
  const filteredLibraries = searchQuery
    ? libraries.filter((l) => l.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : libraries;

  const handleOpenLibrary = useCallback(
    (id: string) => {
      localStorage.setItem("quilliam_last_library", id);
      router.push(`/library/${id}/universe`);
    },
    [router],
  );

  const handleLibrarySetContext = useCallback(
    (id: string) => {
      onSetContext("library", id);
    },
    [onSetContext],
  );

  const handleCreateLoRA = useCallback(
    (draft: Omit<LoRA, "id" | "createdAt" | "updatedAt">) => {
      onCreateLoRA(draft);
      setShowCreateLoRA(false);
    },
    [onCreateLoRA],
  );

  return (
    <nav className="home-sidebar">
      {/* ── Header ── */}
      <div className="home-sidebar-header">
        <span className="home-sidebar-brand">Quilliam</span>
        <button
          className="home-sidebar-new-chat-btn"
          onClick={onNewChat}
          title="New chat"
          aria-label="New chat"
        >
          ✎
        </button>
      </div>

      {/* ── Search ── */}
      <div className="home-sidebar-search-wrap">
        <input
          className="home-sidebar-search"
          type="search"
          placeholder="Search chats, libraries…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search chats and libraries"
        />
      </div>

      {/* ── Primary tabs ── */}
      <div className="home-sidebar-tabs">
        <button
          className={`home-sidebar-tab${activeTab === "chats" ? " home-sidebar-tab--active" : ""}`}
          onClick={() => setActiveTab("chats")}
        >
          Chats
        </button>
        <button
          className={`home-sidebar-tab${activeTab === "loras" ? " home-sidebar-tab--active" : ""}`}
          onClick={() => setActiveTab("loras")}
        >
          LoRAs
        </button>
      </div>

      {/* ── Tab body (scrollable) ── */}
      <div className="home-sidebar-body">

        {/* === Chats tab === */}
        {activeTab === "chats" && (
          <div className="home-sidebar-tab-panel">
            {/* Context selector */}
            <div className="context-selector">
              <label className="context-selector-label" htmlFor="landing-ctx">
                Context:
              </label>
              <select
                id="landing-ctx"
                className="context-selector-select"
                value={contextType === "library" && activeLibraryId ? activeLibraryId : "general"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "general") {
                    onSetContext("general");
                  } else {
                    onSetContext("library", v);
                  }
                }}
              >
                <option value="general">General</option>
                {libraries.map((lib) => (
                  <option key={lib.id} value={lib.id}>
                    {lib.title}
                  </option>
                ))}
              </select>
            </div>

            {/* Thread list or search results */}
            {searchQuery ? (
              <>
                {filteredThreads!.length === 0 ? (
                  <p className="home-sidebar-empty">No chats match &ldquo;{searchQuery}&rdquo;</p>
                ) : (
                  filteredThreads!.map((t) => (
                    <ThreadRow
                      key={t.id}
                      thread={t}
                      isActive={t.id === activeChatId}
                      libraryName={getLibraryName(t.libraryId)}
                      onSelect={() => onSelectThread(t.id)}
                      onRename={(title) => onRenameThread(t.id, title)}
                      onDelete={() => onDeleteThread(t.id)}
                      onPin={() => onPinThread(t.id)}
                    />
                  ))
                )}
              </>
            ) : (
              <>
                {/* Pinned */}
                {threadBuckets.pinned.length > 0 && (
                  <div className="pinned-section">
                    <div className="thread-bucket-label">Pinned</div>
                    {threadBuckets.pinned.map((t) => (
                      <ThreadRow
                        key={t.id}
                        thread={t}
                        isActive={t.id === activeChatId}
                        libraryName={getLibraryName(t.libraryId)}
                        onSelect={() => onSelectThread(t.id)}
                        onRename={(title) => onRenameThread(t.id, title)}
                        onDelete={() => onDeleteThread(t.id)}
                        onPin={() => onPinThread(t.id)}
                      />
                    ))}
                  </div>
                )}

                <BucketSection
                  label="Today"
                  threads={threadBuckets.today}
                  activeChatId={activeChatId}
                  getLibraryName={getLibraryName}
                  onSelectThread={onSelectThread}
                  onRenameThread={onRenameThread}
                  onDeleteThread={onDeleteThread}
                  onPinThread={onPinThread}
                />
                <BucketSection
                  label="Yesterday"
                  threads={threadBuckets.yesterday}
                  activeChatId={activeChatId}
                  getLibraryName={getLibraryName}
                  onSelectThread={onSelectThread}
                  onRenameThread={onRenameThread}
                  onDeleteThread={onDeleteThread}
                  onPinThread={onPinThread}
                />
                <BucketSection
                  label="Previous 7 Days"
                  threads={threadBuckets.last7days}
                  activeChatId={activeChatId}
                  getLibraryName={getLibraryName}
                  onSelectThread={onSelectThread}
                  onRenameThread={onRenameThread}
                  onDeleteThread={onDeleteThread}
                  onPinThread={onPinThread}
                />
                <BucketSection
                  label="Older"
                  threads={threadBuckets.older}
                  activeChatId={activeChatId}
                  getLibraryName={getLibraryName}
                  onSelectThread={onSelectThread}
                  onRenameThread={onRenameThread}
                  onDeleteThread={onDeleteThread}
                  onPinThread={onPinThread}
                />

                {threads.length === 0 && (
                  <p className="home-sidebar-empty">
                    No chats yet. Click <strong>+ New Chat</strong> to begin.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* === LoRAs tab === */}
        {activeTab === "loras" && (
          <div className="home-sidebar-tab-panel">
            <div className="lora-list">
              {loras.map((lora) => (
                <div
                  key={lora.id}
                  className={`lora-row${lora.id === activeLoRAId ? " lora-row--active" : ""}`}
                  onClick={() => onSelectLoRA(lora.id)}
                  title={lora.description}
                >
                  <div className="lora-row-name">{lora.name}</div>
                  <div className="lora-row-desc">{lora.description}</div>
                </div>
              ))}
            </div>

            {showCreateLoRA ? (
              <CreateLoRAForm
                onSubmit={handleCreateLoRA}
                onCancel={() => setShowCreateLoRA(false)}
              />
            ) : (
              <button
                className="home-sidebar-new-lib-btn"
                onClick={() => setShowCreateLoRA(true)}
                style={{ marginTop: 10 }}
              >
                + Create LoRA
              </button>
            )}
          </div>
        )}

        {/* ── Libraries collapsible section (always visible) ── */}
        <div className="libraries-section">
          <button
            className="libraries-section-toggle"
            onClick={() => setLibrariesExpanded((v) => !v)}
            aria-expanded={librariesExpanded}
          >
            <span className="libraries-section-chevron" aria-hidden>
              {librariesExpanded ? "▾" : "▸"}
            </span>
            <span>Libraries</span>
          </button>

          {librariesExpanded && (
            <>
              {filteredLibraries.length === 0 && !searchQuery ? (
                <p className="home-sidebar-empty">No libraries yet.</p>
              ) : filteredLibraries.length === 0 ? (
                <p className="home-sidebar-empty">No libraries match &ldquo;{searchQuery}&rdquo;</p>
              ) : (
                <ul className="home-sidebar-library-list">
                  {filteredLibraries.map((lib) => (
                    <li key={lib.id}>
                      <div
                        className={`home-sidebar-library-row${activeLibraryId === lib.id && contextType === "library" ? " home-sidebar-library-row--active" : ""}`}
                      >
                        <button
                          className="home-sidebar-library-ctx-btn"
                          onClick={() => handleLibrarySetContext(lib.id)}
                          title="Set as active context"
                          aria-label={`Set ${lib.title} as context`}
                        >
                          <span className="home-sidebar-library-icon" aria-hidden>
                            📖
                          </span>
                          <span className="home-sidebar-library-title">{lib.title}</span>
                        </button>
                        <button
                          className="home-sidebar-library-open-btn"
                          onClick={() => handleOpenLibrary(lib.id)}
                          title="Open library workspace"
                          aria-label={`Open ${lib.title}`}
                        >
                          →
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="home-sidebar-footer">
                <button className="home-sidebar-new-lib-btn" onClick={onNewLibrary}>
                  + New Library
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
