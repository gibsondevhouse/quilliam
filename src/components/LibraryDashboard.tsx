"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";

const STATUS_LABELS = {
  drafting: "Drafting",
  editing: "Editing",
  archived: "Archived",
} as const;

const STATUS_COLORS = {
  drafting: "#3b82f6",
  editing: "#f59e0b",
  archived: "#6b7280",
} as const;

export function LibraryDashboard() {
  const router = useRouter();
  const lib = useLibraryContext();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lib.libraryTitle);

  const recentStories = lib.stories.slice(0, 5);
  const recentThreads = lib.chats.slice(0, 5);

  const handleNewStory = useCallback(() => {
    const story = lib.addStory();
    router.push(`/library/${lib.libraryId}/stories/${story.id}`);
  }, [lib, router]);

  const handleNewThread = useCallback(() => {
    lib.addChat();
    lib.setBottomPanelOpen(true);
    router.push(`/library/${lib.libraryId}/threads`);
  }, [lib, router]);

  const handleAddCharacter = useCallback(() => {
    lib.addCharacter();
    router.push(`/library/${lib.libraryId}/characters`);
  }, [lib, router]);

  const commitTitle = useCallback(() => {
    setEditingTitle(false);
    if (titleDraft.trim()) {
      lib.setLibraryTitle(titleDraft.trim());
    }
  }, [titleDraft, lib]);

  return (
    <div className="library-dashboard">
      {/* ---- Header ---- */}
      <div className="library-dashboard-header">
        <div className="library-dashboard-title-row">
          {editingTitle ? (
            <input
              className="library-dashboard-title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }}
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
            style={{ "--status-color": STATUS_COLORS[lib.libraryStatus] } as React.CSSProperties}
            onClick={() => {
              const cycle: Array<"drafting" | "editing" | "archived"> = ["drafting", "editing", "archived"];
              const next = cycle[(cycle.indexOf(lib.libraryStatus) + 1) % cycle.length];
              lib.setLibraryStatus(next);
            }}
            title="Click to cycle status"
          >
            {STATUS_LABELS[lib.libraryStatus]}
          </span>
        </div>

        {lib.libraryDescription ? (
          <p className="library-dashboard-logline">{lib.libraryDescription}</p>
        ) : (
          <p
            className="library-dashboard-logline placeholder"
            onClick={() => {
              const val = prompt("Enter a logline or description for this library:");
              if (val) lib.setLibraryDescription(val);
            }}
          >
            Add a logline or description…
          </p>
        )}

        <div className="library-dashboard-quick-actions">
          <button className="library-dashboard-action" onClick={handleNewStory}>
            + New Story
          </button>
          <button className="library-dashboard-action" onClick={handleNewThread}>
            + New Thread
          </button>
          <button className="library-dashboard-action" onClick={handleAddCharacter}>
            + Add Character
          </button>
        </div>
      </div>

      {/* ---- Cards ---- */}
      <div className="library-dashboard-cards">
        {/* Stories */}
        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Stories <span className="library-dashboard-count">{lib.stories.length}</span></h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/stories`)}>View all →</button>
          </div>
          {recentStories.length === 0 ? (
            <p className="library-dashboard-empty">No stories yet. <button onClick={handleNewStory}>Create one</button></p>
          ) : (
            <ul className="library-dashboard-list">
              {recentStories.map((s) => (
                <li key={s.id}>
                  <button onClick={() => router.push(`/library/${lib.libraryId}/stories/${s.id}`)}>
                    <span className="item-icon">📚</span>
                    <span className="item-title">{s.title}</span>
                    <span className="item-category">{s.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent Threads */}
        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Threads</h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/threads`)}>View all →</button>
          </div>
          {recentThreads.length === 0 ? (
            <p className="library-dashboard-empty">No threads yet. <button onClick={handleNewThread}>Start one</button></p>
          ) : (
            <ul className="library-dashboard-list">
              {recentThreads.map((c) => (
                <li key={c.id}>
                  <button onClick={() => { lib.selectChat(c.id); lib.setBottomPanelOpen(true); }}>
                    <span className="item-icon">💬</span>
                    <span className="item-title">{c.title}</span>
                    {c.preview && <span className="item-preview">{c.preview}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Characters */}
        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Characters <span className="library-dashboard-count">{lib.characters.length}</span></h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/characters`)}>View all →</button>
          </div>
          {lib.characters.length === 0 ? (
            <p className="library-dashboard-empty">No characters yet. <button onClick={handleAddCharacter}>Add one</button></p>
          ) : (
            <div className="library-dashboard-roster">
              {lib.characters.slice(0, 6).map((c) => (
                <div
                  key={c.id}
                  className="library-dashboard-avatar"
                  title={c.name || "Unnamed"}
                  onClick={() => router.push(`/library/${lib.libraryId}/characters`)}
                >
                  {(c.name || "?")[0].toUpperCase()}
                </div>
              ))}
              {lib.characters.length > 6 && (
                <div className="library-dashboard-avatar overflow">+{lib.characters.length - 6}</div>
              )}
            </div>
          )}
        </div>

        {/* Locations */}
        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Locations <span className="library-dashboard-count">{lib.locations.length}</span></h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/locations`)}>View all →</button>
          </div>
          {lib.locations.length === 0 ? (
            <p className="library-dashboard-empty">No locations yet.</p>
          ) : (
            <ul className="library-dashboard-list">
              {lib.locations.slice(0, 4).map((l) => (
                <li key={l.id}>
                  <button onClick={() => router.push(`/library/${lib.libraryId}/locations`)}>
                    <span className="item-icon">📍</span>
                    <span className="item-title">{l.name || "Unnamed"}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* World */}
        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>World <span className="library-dashboard-count">{lib.worldEntries.length}</span></h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/world`)}>View all →</button>
          </div>
          {lib.worldEntries.length === 0 ? (
            <p className="library-dashboard-empty">No world entries yet.</p>
          ) : (
            <ul className="library-dashboard-list">
              {lib.worldEntries.slice(0, 4).map((w) => (
                <li key={w.id}>
                  <button onClick={() => router.push(`/library/${lib.libraryId}/world`)}>
                    <span className="item-icon">🌍</span>
                    <span className="item-title">{w.title || "Untitled"}</span>
                    {w.category && <span className="item-category">{w.category}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Systems — placeholder */}
        <div className="library-dashboard-card placeholder-card">
          <div className="library-dashboard-card-header">
            <h3>Systems</h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/systems`)}>View →</button>
          </div>
          <p className="library-dashboard-empty">Magic, tech &amp; economy systems — coming soon.</p>
        </div>
      </div>
    </div>
  );
}
