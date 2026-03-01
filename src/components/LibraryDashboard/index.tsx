"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import { pathForEntryType } from "@/lib/domain/entryUtils";
import { useLibraryContext } from "@/lib/context/LibraryContext";

import { STATUS_LABELS, STATUS_COLORS } from "./types";
import type { QuickAddAction } from "./types";
import { ModuleGrid } from "./ModuleGrid";
import { BooksGrid } from "./BooksGrid";
import { QuickAdd } from "./QuickAdd";
import { CommandPalette } from "./CommandPalette";
import { FirstRunBanner } from "./FirstRunBanner";
import { ExportButton } from "./ExportButton";
import { useDashboardStats, useQuickCreate } from "./hooks/useDashboardStats";
import { useCommandPalette } from "./hooks/useCommandPalette";

export function LibraryDashboard() {
  const router = useRouter();
  const lib = useLibraryContext();

  // ---- Header edit state --------------------------------------------------
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lib.libraryTitle);
  const [editingLogline, setEditingLogline] = useState(false);
  const [loglineDraft, setLoglineDraft] = useState(lib.libraryDescription ?? "");

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    if (titleDraft.trim()) lib.setLibraryTitle(titleDraft.trim());
  }, [titleDraft, lib]);

  const commitLogline = useCallback(() => {
    setEditingLogline(false);
    if (loglineDraft.trim()) lib.setLibraryDescription(loglineDraft.trim());
  }, [loglineDraft, lib]);

  // ---- Dashboard data -----------------------------------------------------
  const { moduleStats, bookCards, entryIndex, reload } = useDashboardStats({
    libraryId: lib.libraryId,
    stories: lib.stories,
  });

  // ---- Quick create -------------------------------------------------------
  const quickCreate = useQuickCreate({ libraryId: lib.libraryId, reload });

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const handleNewBook = useCallback(() => {
    const story = lib.addStory();
    setQuickAddOpen(false);
    router.push(`/library/${lib.libraryId}/books/${story.id}`);
  }, [lib, router]);

  const handleNewThread = useCallback(() => {
    lib.addChat();
    lib.setBottomPanelOpen(true);
    setQuickAddOpen(false);
    router.push(`/library/${lib.libraryId}/threads`);
  }, [lib, router]);

  const handleAddCharacter = useCallback(() => {
    lib.addCharacter();
    setQuickAddOpen(false);
    router.push(`/library/${lib.libraryId}/characters`);
  }, [lib, router]);

  const handleAddLocation = useCallback(() => {
    lib.addLocation();
    setQuickAddOpen(false);
    router.push(`/library/${lib.libraryId}/locations`);
  }, [lib, router]);

  const quickAddActions = useMemo<QuickAddAction[]>(() => [
    { id: "new-book",     label: "New Book",              hint: "Manuscripts",       action: handleNewBook },
    { id: "new-thread",   label: "New Thread",            hint: "Intelligence",      action: handleNewThread },
    { id: "add-character",label: "Add Character",         hint: "Cast & Lineages",   action: handleAddCharacter },
    { id: "add-location", label: "Add Location",          hint: "World Structures",  action: handleAddLocation },
    {
      id: "add-culture",   label: "Add Culture",          hint: "World Structures",
      action: () => { void quickCreate("culture", "New Culture").then((id) => { if (id) router.push(`/library/${lib.libraryId}/${pathForEntryType("culture")}?highlight=${id}`); }); setQuickAddOpen(false); },
    },
    {
      id: "add-event",     label: "Add Timeline Event",   hint: "Universe Core",
      action: () => { void quickCreate("timeline_event", "New Event").then((id) => { if (id) router.push(`/library/${lib.libraryId}/${pathForEntryType("timeline_event")}?highlight=${id}`); }); setQuickAddOpen(false); },
    },
    {
      id: "add-organization", label: "Add Organization",  hint: "Power Structures",
      action: () => { void quickCreate("organization", "New Organization").then((id) => { if (id) router.push(`/library/${lib.libraryId}/${pathForEntryType("organization")}?highlight=${id}`); }); setQuickAddOpen(false); },
    },
  ], [handleAddCharacter, handleAddLocation, handleNewBook, handleNewThread, quickCreate, lib.libraryId, router]);

  // Close QuickAdd on outside click
  useEffect(() => {
    if (!quickAddOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target as Node)) {
        setQuickAddOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [quickAddOpen]);

  // ---- Command palette ----------------------------------------------------
  const palette = useCommandPalette({
    libraryId: lib.libraryId,
    bookCards,
    entryIndex,
  });

  // ---- Recent threads -----------------------------------------------------
  const recentThreads = lib.chats.slice(0, 5);

  return (
    <div className="library-dashboard">
      {/* Header */}
      <div className="library-dashboard-header">
        <div className="library-dashboard-title-row">
          {editingTitle ? (
            <input
              className="library-dashboard-title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <h1
              className="library-dashboard-title"
              onClick={() => { setTitleDraft(lib.libraryTitle); setEditingTitle(true); }}
              title="Click to edit"
            >
              {lib.libraryTitle}
            </h1>
          )}
          <span
            className="library-dashboard-status"
            style={{ "--status-color": STATUS_COLORS[lib.libraryStatus] } as CSSProperties}
            onClick={() => {
              const cycle: Array<"drafting" | "editing" | "archived"> = ["drafting", "editing", "archived"];
              lib.setLibraryStatus(cycle[(cycle.indexOf(lib.libraryStatus) + 1) % cycle.length]);
            }}
            title="Click to cycle status"
          >
            {STATUS_LABELS[lib.libraryStatus]}
          </span>
        </div>

        {editingLogline ? (
          <input
            className="library-dashboard-logline-input"
            value={loglineDraft}
            autoFocus
            placeholder="Enter a logline or description..."
            onChange={(e) => setLoglineDraft(e.target.value)}
            onBlur={commitLogline}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLogline();
              if (e.key === "Escape") setEditingLogline(false);
            }}
          />
        ) : lib.libraryDescription ? (
          <p className="library-dashboard-logline" onClick={() => { setLoglineDraft(lib.libraryDescription ?? ""); setEditingLogline(true); }} title="Click to edit">
            {lib.libraryDescription}
          </p>
        ) : (
          <p className="library-dashboard-logline placeholder" onClick={() => { setLoglineDraft(""); setEditingLogline(true); }}>
            Add a logline or description...
          </p>
        )}

        <div className="library-dashboard-toolbar">
          <button className="library-dashboard-search-btn" onClick={palette.openPalette}>
            Global Search
            <span className="library-dashboard-toolbar-kbd">⌘K</span>
          </button>
          <ExportButton />
          <QuickAdd
            open={quickAddOpen}
            onToggle={() => setQuickAddOpen((o) => !o)}
            actions={quickAddActions}
            containerRef={quickAddRef}
          />
        </div>
      </div>

      {/* First-run onboarding — shown when universe is empty and stats have loaded */}
      {Object.keys(moduleStats).length > 0 && bookCards.length === 0 && entryIndex.length === 0 && (
        <FirstRunBanner
          libraryId={lib.libraryId}
          libraryTitle={lib.libraryTitle}
          onNavigate={router.push}
          onNewBook={handleNewBook}
        />
      )}

      {/* Module grid */}
      <ModuleGrid
        moduleStats={moduleStats}
        libraryId={lib.libraryId}
        onNavigate={router.push}
      />

      {/* Books */}
      <BooksGrid
        bookCards={bookCards}
        libraryId={lib.libraryId}
        onNavigate={router.push}
        onNewBook={handleNewBook}
      />

      {/* Recent threads */}
      <section className="library-dashboard-section">
        <div className="library-dashboard-section-heading">
          <h2>Recent Threads</h2>
        </div>
        <div className="library-dashboard-card">
          {recentThreads.length === 0 ? (
            <p className="library-dashboard-empty">No threads yet. Use Quick Add to open a new thread.</p>
          ) : (
            <ul className="library-dashboard-list">
              {recentThreads.map((thread) => (
                <li key={thread.id}>
                  <button onClick={() => { lib.selectChat(thread.id); lib.setBottomPanelOpen(true); }}>
                    <span className="item-icon">💬</span>
                    <span className="item-title">{thread.title}</span>
                    {thread.preview && <span className="item-preview">{thread.preview}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Command palette overlay */}
      {palette.searchOpen && (
        <CommandPalette
          searchQuery={palette.searchQuery}
          setSearchQuery={palette.setSearchQuery}
          selectedSearchIndex={palette.selectedSearchIndex}
          setSelectedSearchIndex={palette.setSelectedSearchIndex}
          filteredSearchItems={palette.filteredSearchItems}
          handleSearchSelect={palette.handleSearchSelect}
          onClose={() => palette.setSearchOpen(false)}
          searchInputRef={palette.searchInputRef}
        />
      )}
    </div>
  );
}
