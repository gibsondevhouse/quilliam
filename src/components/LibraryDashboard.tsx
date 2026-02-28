"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface ModuleStat {
  count: number;
  lastUpdated?: number;
}

const EMPTY_STAT: ModuleStat = { count: 0 };

function formatLastUpdated(ts?: number): string {
  if (!ts) return "No updates";
  const deltaMs = Date.now() - ts;
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export function LibraryDashboard() {
  const router = useRouter();
  const lib = useLibraryContext();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lib.libraryTitle);

  const [editingLogline, setEditingLogline] = useState(false);
  const [loglineDraft, setLoglineDraft] = useState(lib.libraryDescription ?? "");

  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStat>>({});

  const recentThreads = lib.chats.slice(0, 5);

  const handleNewBook = useCallback(() => {
    const story = lib.addStory();
    router.push(`/library/${lib.libraryId}/books/${story.id}`);
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

  const commitLogline = useCallback(() => {
    setEditingLogline(false);
    if (loglineDraft.trim()) {
      lib.setLibraryDescription(loglineDraft.trim());
    }
  }, [loglineDraft, lib]);

  useEffect(() => {
    if (!lib.storeReady) return;
    const store = lib.storeRef.current;
    if (!store) return;

    void (async () => {
      const [
        characters,
        locations,
        cultures,
        religions,
        languages,
        economics,
        organizations,
        lineages,
        items,
        rules,
        scenes,
        timeline,
        systems,
        suggestions,
        continuity,
      ] = await Promise.all([
        store.queryEntriesByType("character"),
        store.queryEntriesByType("location"),
        store.queryEntriesByType("culture"),
        store.queryEntriesByType("religion"),
        store.queryEntriesByType("language"),
        store.queryEntriesByType("economy"),
        store.queryEntriesByType("organization"),
        store.queryEntriesByType("lineage"),
        store.queryEntriesByType("item"),
        store.queryEntriesByType("rule"),
        store.queryEntriesByType("scene"),
        store.queryEntriesByType("timeline_event"),
        store.queryEntriesByType("system"),
        store.listSuggestionsByUniverse(lib.libraryId),
        store.listContinuityIssuesByUniverse(lib.libraryId),
      ]);

      const newest = (rows: Array<{ updatedAt: number }>): number | undefined =>
        rows.length > 0 ? Math.max(...rows.map((row) => row.updatedAt)) : undefined;

      setModuleStats({
        books: { count: lib.stories.length, lastUpdated: newest(lib.stories.map((s) => ({ updatedAt: s.createdAt }))) },
        characters: { count: characters.length, lastUpdated: newest(characters) },
        locations: { count: locations.length, lastUpdated: newest(locations) },
        cultures: { count: cultures.length, lastUpdated: newest(cultures) },
        religions: { count: religions.length, lastUpdated: newest(religions) },
        languages: { count: languages.length, lastUpdated: newest(languages) },
        economics: { count: economics.length, lastUpdated: newest(economics) },
        organizations: { count: organizations.length, lastUpdated: newest(organizations) },
        lineages: { count: lineages.length, lastUpdated: newest(lineages) },
        items: { count: items.length, lastUpdated: newest(items) },
        rules: { count: rules.length, lastUpdated: newest(rules) },
        systems: { count: systems.length, lastUpdated: newest(systems) },
        scenes: { count: scenes.length, lastUpdated: newest(scenes) },
        timeline: { count: timeline.length, lastUpdated: newest(timeline) },
        suggestions: { count: suggestions.length, lastUpdated: newest(suggestions) },
        continuity: { count: continuity.length, lastUpdated: newest(continuity) },
        maps: EMPTY_STAT,
        media: EMPTY_STAT,
      });
    })();
  }, [lib.libraryId, lib.stories, lib.storeReady, lib.storeRef]);

  const moduleCards = useMemo(() => [
    { key: "books", label: "Books", path: "books", desc: "Book-level planning and chapter flow." },
    { key: "scenes", label: "Scenes", path: "scenes", desc: "Scene entities and scene-linked continuity." },
    { key: "timeline", label: "Master Timeline", path: "master-timeline", desc: "Universe chronology and events." },
    { key: "characters", label: "Characters", path: "characters", desc: "People and POV entities." },
    { key: "locations", label: "Locations", path: "locations", desc: "Places and setting anchors." },
    { key: "cultures", label: "Cultures", path: "cultures", desc: "Culture canon and versioning." },
    { key: "religions", label: "Religions", path: "religions", desc: "Beliefs, sects, and doctrine." },
    { key: "languages", label: "Languages", path: "languages", desc: "Language families and usage." },
    { key: "economics", label: "Economics", path: "economics", desc: "Trade, markets, and resource systems." },
    { key: "organizations", label: "Organizations", path: "organizations", desc: "Institutions, factions, and groups." },
    { key: "lineages", label: "Lineages", path: "lineages", desc: "Family lines and ancestry." },
    { key: "items", label: "Items", path: "items", desc: "Artifacts, tools, and ownership." },
    { key: "rules", label: "Rules", path: "rules", desc: "Canon constraints and governing rules." },
    { key: "systems", label: "Systems", path: "rules", desc: "Magic/tech systems tracked with rules." },
    { key: "maps", label: "Maps", path: "maps", desc: "Spatial layer and pinning." },
    { key: "media", label: "Media", path: "media", desc: "Reference media and linked assets." },
    { key: "suggestions", label: "Suggestions", path: "suggestions", desc: "Review queue for EntryPatch proposals." },
    { key: "continuity", label: "Continuity Issues", path: "continuity-issues", desc: "Deterministic continuity checks." },
  ], []);

  return (
    <div className="library-dashboard">
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
              onClick={() => {
                setTitleDraft(lib.libraryTitle);
                setEditingTitle(true);
              }}
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

        {editingLogline ? (
          <input
            className="library-dashboard-logline-input"
            value={loglineDraft}
            autoFocus
            placeholder="Enter a logline or description…"
            onChange={(e) => setLoglineDraft(e.target.value)}
            onBlur={commitLogline}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitLogline();
              if (e.key === "Escape") setEditingLogline(false);
            }}
          />
        ) : lib.libraryDescription ? (
          <p
            className="library-dashboard-logline"
            onClick={() => {
              setLoglineDraft(lib.libraryDescription ?? "");
              setEditingLogline(true);
            }}
            title="Click to edit"
          >
            {lib.libraryDescription}
          </p>
        ) : (
          <p
            className="library-dashboard-logline placeholder"
            onClick={() => {
              setLoglineDraft("");
              setEditingLogline(true);
            }}
          >
            Add a logline or description…
          </p>
        )}

        <div className="library-dashboard-quick-actions">
          <button className="library-dashboard-action" onClick={handleNewBook}>
            + New Book
          </button>
          <button className="library-dashboard-action" onClick={handleNewThread}>
            + New Thread
          </button>
          <button className="library-dashboard-action" onClick={handleAddCharacter}>
            + Add Character
          </button>
        </div>
      </div>

      <div className="library-dashboard-cards">
        {moduleCards.map((card) => {
          const stat = moduleStats[card.key] ?? EMPTY_STAT;
          return (
            <div key={card.key} className="library-dashboard-card">
              <div className="library-dashboard-card-header">
                <h3>
                  {card.label} <span className="library-dashboard-count">{stat.count}</span>
                </h3>
                <button onClick={() => router.push(`/library/${lib.libraryId}/${card.path}`)}>
                  Open →
                </button>
              </div>
              <p className="library-dashboard-empty" style={{ marginBottom: 8 }}>
                {card.desc}
              </p>
              <p className="item-preview">{formatLastUpdated(stat.lastUpdated)}</p>
            </div>
          );
        })}

        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Threads <span className="library-dashboard-count">{lib.chats.length}</span></h3>
            <button onClick={() => router.push(`/library/${lib.libraryId}/threads`)}>Open →</button>
          </div>
          {recentThreads.length === 0 ? (
            <p className="library-dashboard-empty">No threads yet. Use + New Thread to start one.</p>
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
      </div>
    </div>
  );
}
