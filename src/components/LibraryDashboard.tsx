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
import { applyCultureDetails, createDefaultCultureDetails } from "@/lib/domain/culture";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { Entry, EntryType } from "@/lib/types";

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

const TYPE_PREFIX: Record<EntryType, string> = {
  character: "char",
  location: "loc",
  culture: "cul",
  organization: "org",
  system: "sys",
  item: "itm",
  language: "lng",
  religion: "rel",
  lineage: "lin",
  economy: "eco",
  rule: "rul",
  faction: "fac",
  magic_system: "mgc",
  lore_entry: "lre",
  scene: "scn",
  timeline_event: "evt",
};

interface ModuleStat {
  count: number;
  lastUpdated?: number;
  openIssues?: number;
}

interface BookCardStat {
  id: string;
  title: string;
  status: "drafting" | "editing" | "archived";
  chapters: number;
  scenes: number;
  lastEdited?: number;
  notes: string;
}

interface ModuleCardConfig {
  key: string;
  label: string;
  path: string;
  description: string;
  cta: string;
  icon: string;
}

interface ModuleSectionConfig {
  key: string;
  label: string;
  cards: ModuleCardConfig[];
}

interface SearchItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  href?: string;
  onSelect?: () => void;
}

interface QuickAddAction {
  id: string;
  label: string;
  hint: string;
  action: () => void;
}

const MODULE_SECTIONS: ModuleSectionConfig[] = [
  {
    key: "universe-core",
    label: "Universe Core",
    cards: [
      {
        key: "overview",
        label: "Overview",
        path: "universe",
        description: "Universe brief, baseline lore, and author-facing summary.",
        cta: "Open Overview",
        icon: "◎",
      },
      {
        key: "timeline",
        label: "Master Timeline",
        path: "master-timeline",
        description: "Canonical chronology of eras and events.",
        cta: "Add Event",
        icon: "⏱",
      },
      {
        key: "cosmology",
        label: "Cosmology",
        path: "cosmology",
        description: "Creation myths, metaphysics, and cosmological model.",
        cta: "Edit Cosmology",
        icon: "✶",
      },
      {
        key: "systems",
        label: "Magic/Tech Systems",
        path: "magic-systems",
        description: "Power systems and operating constraints.",
        cta: "Add System",
        icon: "⚙",
      },
      {
        key: "rules",
        label: "Rules of Reality",
        path: "rules",
        description: "Fundamental laws and non-negotiable constraints.",
        cta: "Add Rule",
        icon: "◈",
      },
    ],
  },
  {
    key: "world-structures",
    label: "World Structures",
    cards: [
      {
        key: "locations",
        label: "Regions & Locations",
        path: "locations",
        description: "Geography, settlements, and world anchors.",
        cta: "Add Location",
        icon: "⌂",
      },
      {
        key: "cultures",
        label: "Cultures",
        path: "cultures",
        description: "Culture ontology, subcultures, and evolution.",
        cta: "Add Culture",
        icon: "⚑",
      },
      {
        key: "religions",
        label: "Religions",
        path: "religions",
        description: "Beliefs, rites, and institutions.",
        cta: "Add Religion",
        icon: "☽",
      },
      {
        key: "languages",
        label: "Languages",
        path: "languages",
        description: "Language families, scripts, and naming norms.",
        cta: "Add Language",
        icon: "✎",
      },
      {
        key: "economics",
        label: "Economics",
        path: "economics",
        description: "Trade systems, currencies, and resources.",
        cta: "Add Economy",
        icon: "¤",
      },
      {
        key: "laws",
        label: "Laws",
        path: "rules",
        description: "Legal frameworks and civil enforcement.",
        cta: "Add Law",
        icon: "⚖",
      },
    ],
  },
  {
    key: "power-structures",
    label: "Power Structures",
    cards: [
      {
        key: "organizations",
        label: "Kingdoms & Empires",
        path: "organizations",
        description: "States, houses, and power blocs.",
        cta: "Add Polity",
        icon: "♜",
      },
      {
        key: "factions",
        label: "Factions & Orders",
        path: "factions",
        description: "Guilds, orders, cells, and influence networks.",
        cta: "Add Faction",
        icon: "⚔",
      },
      {
        key: "conflicts",
        label: "Conflicts & Treaties",
        path: "conflicts",
        description: "Wars, alliances, and diplomatic pressure points.",
        cta: "Review Conflicts",
        icon: "☍",
      },
    ],
  },
  {
    key: "cast-lineages",
    label: "Cast & Lineages",
    cards: [
      {
        key: "characters",
        label: "Characters",
        path: "characters",
        description: "Major cast, supporting cast, and POV network.",
        cta: "Add Character",
        icon: "☺",
      },
      {
        key: "lineages",
        label: "Lineages",
        path: "lineages",
        description: "Houses, clans, and bloodline structures.",
        cta: "Add Lineage",
        icon: "⟟",
      },
      {
        key: "relationship-web",
        label: "Relationship Web",
        path: "relationship-web",
        description: "Connections view for multi-hop character links.",
        cta: "Open Graph",
        icon: "⤳",
      },
    ],
  },
  {
    key: "artifacts-media",
    label: "Artifacts & Media",
    cards: [
      {
        key: "items",
        label: "Items & Relics",
        path: "items",
        description: "Artifacts, ownership, and provenance tracking.",
        cta: "Add Item",
        icon: "◆",
      },
      {
        key: "maps",
        label: "Maps",
        path: "maps",
        description: "Spatial visualization with map pins and regions.",
        cta: "New Map",
        icon: "🗺",
      },
      {
        key: "media",
        label: "Media Library",
        path: "media",
        description: "Attached references, art, and source media.",
        cta: "Upload Media",
        icon: "▣",
      },
    ],
  },
  {
    key: "manuscripts",
    label: "Manuscripts",
    cards: [
      {
        key: "books",
        label: "Books",
        path: "books",
        description: "Series structure and book-level production status.",
        cta: "Open Books",
        icon: "📖",
      },
      {
        key: "scenes",
        label: "Scenes",
        path: "scenes",
        description: "Scene-level planning with mentions and anchors.",
        cta: "Open Scenes",
        icon: "¶",
      },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    cards: [
      {
        key: "suggestions",
        label: "Suggestions",
        path: "suggestions",
        description: "Review queue for proposed canon changes.",
        cta: "Review Suggestions",
        icon: "✦",
      },
      {
        key: "continuity",
        label: "Continuity Issues",
        path: "continuity-issues",
        description: "Deterministic checks, triage, and resolution workflow.",
        cta: "Review Issues",
        icon: "⚠",
      },
      {
        key: "change-log",
        label: "Change Log",
        path: "change-log",
        description: "Revision trail and canon history snapshots.",
        cta: "Open Log",
        icon: "🧾",
      },
    ],
  },
];

const EMPTY_STAT: ModuleStat = { count: 0, openIssues: 0 };

function makeEntryId(type: EntryType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type] ?? "ent"}_${slug}`;
}

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

function newest(rows: Array<{ updatedAt: number }>): number | undefined {
  return rows.length > 0 ? Math.max(...rows.map((row) => row.updatedAt)) : undefined;
}

function pathForEntryType(entryType: EntryType): string {
  switch (entryType) {
    case "character":
      return "characters";
    case "location":
      return "locations";
    case "culture":
      return "cultures";
    case "organization":
      return "organizations";
    case "faction":
      return "factions";
    case "system":
    case "magic_system":
      return "magic-systems";
    case "item":
      return "items";
    case "language":
      return "languages";
    case "religion":
      return "religions";
    case "lineage":
      return "lineages";
    case "economy":
      return "economics";
    case "rule":
      return "rules";
    case "scene":
      return "scenes";
    case "timeline_event":
      return "master-timeline";
    case "lore_entry":
      return "cosmology";
    default:
      return "universe";
  }
}

function moduleKeysForEntryType(entryType: EntryType): string[] {
  switch (entryType) {
    case "character":
      return ["characters", "relationship-web"];
    case "location":
      return ["locations"];
    case "culture":
      return ["cultures"];
    case "organization":
      return ["organizations", "conflicts"];
    case "faction":
      return ["factions", "conflicts"];
    case "system":
    case "magic_system":
      return ["systems"];
    case "item":
      return ["items"];
    case "language":
      return ["languages"];
    case "religion":
      return ["religions"];
    case "lineage":
      return ["lineages", "relationship-web"];
    case "economy":
      return ["economics"];
    case "rule":
      return ["rules", "laws"];
    case "scene":
      return ["scenes"];
    case "timeline_event":
      return ["timeline", "conflicts"];
    case "lore_entry":
      return ["cosmology", "overview"];
    default:
      return [];
  }
}

function buildIssueHeatmap(
  issues: Array<{ checkType: string; evidence: Array<{ type: string; id: string }> }>,
  entries: Entry[],
): Record<string, number> {
  const heat: Record<string, number> = {};
  const byId = new Map(entries.map((entry) => [entry.id, entry] as const));

  const bump = (key: string) => {
    heat[key] = (heat[key] ?? 0) + 1;
  };

  for (const issue of issues) {
    const keys = new Set<string>();
    for (const ev of issue.evidence) {
      if (ev.type !== "entry" && ev.type !== "event" && ev.type !== "scene") continue;
      const entry = byId.get(ev.id);
      if (entry) {
        for (const key of moduleKeysForEntryType(entry.entryType)) {
          keys.add(key);
        }
      } else if (ev.type === "event") {
        keys.add("timeline");
      } else if (ev.type === "scene") {
        keys.add("scenes");
      }
    }

    if (issue.checkType.includes("timeline") || issue.checkType.includes("death")) {
      keys.add("timeline");
    }
    if (issue.checkType.includes("culture")) {
      keys.add("cultures");
      keys.add("characters");
    }
    if (issue.checkType.includes("mention")) {
      keys.add("scenes");
    }

    if (keys.size === 0) keys.add("continuity");
    keys.add("continuity");

    for (const key of keys) bump(key);
  }

  return heat;
}

export function LibraryDashboard() {
  const router = useRouter();
  const lib = useLibraryContext();

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(lib.libraryTitle);

  const [editingLogline, setEditingLogline] = useState(false);
  const [loglineDraft, setLoglineDraft] = useState(lib.libraryDescription ?? "");

  const [moduleStats, setModuleStats] = useState<Record<string, ModuleStat>>({});
  const [bookCards, setBookCards] = useState<BookCardStat[]>([]);
  const [entryIndex, setEntryIndex] = useState<Entry[]>([]);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSearchIndex, setSelectedSearchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickAddRef = useRef<HTMLDivElement>(null);

  const recentThreads = lib.chats.slice(0, 5);

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

  const loadDashboardData = useCallback(async () => {
    if (!lib.storeReady) return;
    const store = lib.storeRef.current;
    if (!store) return;

    const [
      characters,
      locations,
      cultures,
      religions,
      languages,
      economics,
      organizations,
      factions,
      lineages,
      items,
      rules,
      scenes,
      timeline,
      systems,
      suggestions,
      continuity,
      maps,
      media,
    ] = await Promise.all([
      store.queryEntriesByType("character"),
      store.queryEntriesByType("location"),
      store.queryEntriesByType("culture"),
      store.queryEntriesByType("religion"),
      store.queryEntriesByType("language"),
      store.queryEntriesByType("economy"),
      store.queryEntriesByType("organization"),
      store.queryEntriesByType("faction"),
      store.queryEntriesByType("lineage"),
      store.queryEntriesByType("item"),
      store.queryEntriesByType("rule"),
      store.queryEntriesByType("scene"),
      store.queryEntriesByType("timeline_event"),
      store.queryEntriesByType("system"),
      store.listSuggestionsByUniverse(lib.libraryId),
      store.listContinuityIssuesByUniverse(lib.libraryId),
      store.listMapsByUniverse(lib.libraryId),
      store.listMediaByUniverse(lib.libraryId),
    ]);

    const allEntries = [
      ...characters,
      ...locations,
      ...cultures,
      ...religions,
      ...languages,
      ...economics,
      ...organizations,
      ...factions,
      ...lineages,
      ...items,
      ...rules,
      ...scenes,
      ...timeline,
      ...systems,
    ];

    const openIssues = continuity.filter((issue) => issue.status === "open" || issue.status === "in_review");
    const issueHeat = buildIssueHeatmap(openIssues, allEntries);
    const relationCount = new Set(
      allEntries.flatMap((entry) => entry.relationships.map((rel) => rel.relationshipId)),
    ).size;

    setModuleStats({
      overview: {
        count: 1,
        lastUpdated: newest(allEntries),
        openIssues: issueHeat.overview ?? 0,
      },
      timeline: {
        count: timeline.length,
        lastUpdated: newest(timeline),
        openIssues: issueHeat.timeline ?? 0,
      },
      cosmology: {
        count: 1,
        lastUpdated: newest(rules),
        openIssues: issueHeat.cosmology ?? 0,
      },
      systems: {
        count: systems.length,
        lastUpdated: newest(systems),
        openIssues: issueHeat.systems ?? 0,
      },
      rules: {
        count: rules.length,
        lastUpdated: newest(rules),
        openIssues: issueHeat.rules ?? 0,
      },
      laws: {
        count: rules.length,
        lastUpdated: newest(rules),
        openIssues: issueHeat.laws ?? 0,
      },
      locations: {
        count: locations.length,
        lastUpdated: newest(locations),
        openIssues: issueHeat.locations ?? 0,
      },
      cultures: {
        count: cultures.length,
        lastUpdated: newest(cultures),
        openIssues: issueHeat.cultures ?? 0,
      },
      religions: {
        count: religions.length,
        lastUpdated: newest(religions),
        openIssues: issueHeat.religions ?? 0,
      },
      languages: {
        count: languages.length,
        lastUpdated: newest(languages),
        openIssues: issueHeat.languages ?? 0,
      },
      economics: {
        count: economics.length,
        lastUpdated: newest(economics),
        openIssues: issueHeat.economics ?? 0,
      },
      organizations: {
        count: organizations.length,
        lastUpdated: newest(organizations),
        openIssues: issueHeat.organizations ?? 0,
      },
      factions: {
        count: factions.length,
        lastUpdated: newest(factions),
        openIssues: issueHeat.factions ?? 0,
      },
      conflicts: {
        count: openIssues.filter((issue) => issue.severity !== "note").length,
        lastUpdated: newest(openIssues),
        openIssues: issueHeat.conflicts ?? openIssues.length,
      },
      characters: {
        count: characters.length,
        lastUpdated: newest(characters),
        openIssues: issueHeat.characters ?? 0,
      },
      lineages: {
        count: lineages.length,
        lastUpdated: newest(lineages),
        openIssues: issueHeat.lineages ?? 0,
      },
      "relationship-web": {
        count: relationCount,
        lastUpdated: newest(allEntries),
        openIssues: issueHeat["relationship-web"] ?? 0,
      },
      items: {
        count: items.length,
        lastUpdated: newest(items),
        openIssues: issueHeat.items ?? 0,
      },
      maps: {
        count: maps.length,
        lastUpdated: newest(maps),
        openIssues: issueHeat.maps ?? 0,
      },
      media: {
        count: media.length,
        lastUpdated: newest(media),
        openIssues: issueHeat.media ?? 0,
      },
      books: {
        count: lib.stories.length,
        lastUpdated: newest(lib.stories.map((story) => ({ updatedAt: story.createdAt }))),
        openIssues: issueHeat.books ?? 0,
      },
      scenes: {
        count: scenes.length,
        lastUpdated: newest(scenes),
        openIssues: issueHeat.scenes ?? 0,
      },
      suggestions: {
        count: suggestions.filter((row) => row.status === "pending").length,
        lastUpdated: newest(suggestions),
        openIssues: issueHeat.suggestions ?? 0,
      },
      continuity: {
        count: openIssues.length,
        lastUpdated: newest(openIssues),
        openIssues: openIssues.length,
      },
      "change-log": {
        count: 0,
        lastUpdated: newest(allEntries),
        openIssues: issueHeat["change-log"] ?? 0,
      },
    });

    const bookRows = await Promise.all(lib.stories.map(async (story) => {
      const chapters = await store.listChaptersByBook(story.id);
      const sceneGroups = await Promise.all(chapters.map((chapter) => store.listScenesByChapter(chapter.id)));
      const scenesCount = sceneGroups.reduce((acc, group) => acc + group.length, 0);
      const chapterUpdates = chapters.map((chapter) => chapter.updatedAt);
      const sceneUpdates = sceneGroups.flat().map((scene) => scene.updatedAt);
      const lastEdited = Math.max(story.createdAt, ...chapterUpdates, ...sceneUpdates);

      return {
        id: story.id,
        title: story.title,
        status: story.status,
        chapters: chapters.length,
        scenes: scenesCount,
        lastEdited,
        notes: scenesCount === 0
          ? "Outline in progress"
          : `${scenesCount} scene${scenesCount === 1 ? "" : "s"} drafted`,
      } satisfies BookCardStat;
    }));

    setBookCards(bookRows.sort((a, b) => b.lastEdited - a.lastEdited));
    setEntryIndex(allEntries.sort((a, b) => b.updatedAt - a.updatedAt));
  }, [lib.libraryId, lib.stories, lib.storeReady, lib.storeRef]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboardData();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboardData]);

  const quickCreateEntry = useCallback(async (entryType: EntryType, label: string) => {
    const store = lib.storeRef.current;
    if (!store) return;

    const now = Date.now();
    const id = makeEntryId(entryType, `${label}-${now}`);
    const details = entryType === "culture"
      ? applyCultureDetails({}, createDefaultCultureDetails())
      : {};

    const entry: Entry = {
      id,
      universeId: lib.libraryId,
      entryType,
      name: label,
      slug: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary: "",
      bodyMd: "",
      canonStatus: "draft",
      visibility: "private",
      details,
      type: entryType,
      status: "draft",
      sources: [],
      relationships: [],
      lastVerified: 0,
      createdAt: now,
      updatedAt: now,
    };

    await store.addEntry(entry);
    setQuickAddOpen(false);
    await loadDashboardData();
    router.push(`/library/${lib.libraryId}/${pathForEntryType(entryType)}?highlight=${id}`);
  }, [lib.libraryId, lib.storeRef, loadDashboardData, router]);

  const quickAddActions = useMemo<QuickAddAction[]>(() => [
    { id: "new-book", label: "New Book", hint: "Manuscripts", action: handleNewBook },
    { id: "new-thread", label: "New Thread", hint: "Intelligence", action: handleNewThread },
    { id: "add-character", label: "Add Character", hint: "Cast & Lineages", action: handleAddCharacter },
    { id: "add-location", label: "Add Location", hint: "World Structures", action: handleAddLocation },
    {
      id: "add-culture",
      label: "Add Culture",
      hint: "World Structures",
      action: () => {
        void quickCreateEntry("culture", "New Culture");
      },
    },
    {
      id: "add-event",
      label: "Add Timeline Event",
      hint: "Universe Core",
      action: () => {
        void quickCreateEntry("timeline_event", "New Event");
      },
    },
    {
      id: "add-organization",
      label: "Add Organization",
      hint: "Power Structures",
      action: () => {
        void quickCreateEntry("organization", "New Organization");
      },
    },
  ], [
    handleAddCharacter,
    handleAddLocation,
    handleNewBook,
    handleNewThread,
    quickCreateEntry,
  ]);

  useEffect(() => {
    if (!quickAddOpen) return undefined;
    const onMouseDown = (event: MouseEvent) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target as Node)) {
        setQuickAddOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [quickAddOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setSearchQuery("");
        setSelectedSearchIndex(0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => {
      searchInputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  const searchItems = useMemo<SearchItem[]>(() => {
    const moduleItems = MODULE_SECTIONS.flatMap((section) =>
      section.cards.map((card) => ({
        id: `module:${card.key}`,
        label: card.label,
        hint: section.label,
        icon: card.icon,
        href: `/library/${lib.libraryId}/${card.path}`,
      })),
    );

    const bookItems = bookCards.map((book) => ({
      id: `book:${book.id}`,
      label: book.title,
      hint: `Book · ${STATUS_LABELS[book.status]}`,
      icon: "📖",
      href: `/library/${lib.libraryId}/books/${book.id}`,
    }));

    const entryItems = entryIndex.slice(0, 400).map((entry) => ({
      id: `entry:${entry.id}`,
      label: entry.name || "Unnamed Entry",
      hint: `${entry.entryType.replace(/_/g, " ")} · ${entry.canonStatus}`,
      icon: "•",
      href: `/library/${lib.libraryId}/${pathForEntryType(entry.entryType)}?highlight=${entry.id}`,
    }));

    return [...moduleItems, ...bookItems, ...entryItems];
  }, [bookCards, entryIndex, lib.libraryId]);

  const filteredSearchItems = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return searchItems.slice(0, 30);
    return searchItems
      .filter((item) => {
        const haystack = `${item.label} ${item.hint}`.toLowerCase();
        return haystack.includes(query);
      })
      .slice(0, 30);
  }, [searchItems, searchQuery]);

  const handleSearchSelect = useCallback((item: SearchItem) => {
    setSearchOpen(false);
    setSearchQuery("");
    if (item.onSelect) {
      item.onSelect();
      return;
    }
    if (item.href) {
      router.push(item.href);
    }
  }, [router]);

  const selectedSearchItem = filteredSearchItems[selectedSearchIndex];

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
            style={{ "--status-color": STATUS_COLORS[lib.libraryStatus] } as CSSProperties}
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
            placeholder="Enter a logline or description..."
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
            Add a logline or description...
          </p>
        )}

        <div className="library-dashboard-toolbar">
          <button
            className="library-dashboard-search-btn"
            onClick={() => {
              setSearchOpen(true);
              setSearchQuery("");
              setSelectedSearchIndex(0);
            }}
          >
            Global Search
            <span className="library-dashboard-toolbar-kbd">⌘K</span>
          </button>

          <div className="library-dashboard-quick-add-wrap" ref={quickAddRef}>
            <button
              className="library-dashboard-action"
              onClick={() => setQuickAddOpen((open) => !open)}
            >
              Quick Add +
            </button>
            {quickAddOpen && (
              <div className="library-dashboard-quick-add-menu">
                {quickAddActions.map((item) => (
                  <button
                    key={item.id}
                    className="library-dashboard-quick-add-item"
                    onClick={item.action}
                  >
                    <span>{item.label}</span>
                    <span className="library-dashboard-quick-add-hint">{item.hint}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="library-dashboard-sections">
        {MODULE_SECTIONS.map((section) => (
          <section key={section.key} className="library-dashboard-section">
            <div className="library-dashboard-section-heading">
              <h2>{section.label}</h2>
            </div>
            <div className="library-dashboard-cards">
              {section.cards.map((card) => {
                const stat = moduleStats[card.key] ?? EMPTY_STAT;
                return (
                  <div key={card.key} className="library-dashboard-card">
                    <div className="library-dashboard-card-header">
                      <h3>
                        <span>{card.icon}</span>
                        <span>{card.label}</span>
                        <span className="library-dashboard-count">{stat.count}</span>
                      </h3>
                      <button
                        className="library-dashboard-card-cta"
                        onClick={() => router.push(`/library/${lib.libraryId}/${card.path}`)}
                      >
                        {card.cta} →
                      </button>
                    </div>
                    <p className="library-dashboard-empty">{card.description}</p>
                    <div className="library-dashboard-card-meta">
                      <span>{formatLastUpdated(stat.lastUpdated)}</span>
                      <span className="library-dashboard-card-issues">
                        {stat.openIssues ?? 0} continuity issue{(stat.openIssues ?? 0) === 1 ? "" : "s"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <section className="library-dashboard-section">
        <div className="library-dashboard-section-heading">
          <h2>Books</h2>
        </div>
        <div className="library-dashboard-book-grid">
          {bookCards.map((book) => (
            <article key={book.id} className="library-dashboard-book-card">
              <div className="library-dashboard-book-title-row">
                <strong>{book.title}</strong>
                <span className="library-dashboard-count">{STATUS_LABELS[book.status]}</span>
              </div>
              <div className="library-dashboard-book-metrics">
                <span>{book.chapters} chapter{book.chapters === 1 ? "" : "s"}</span>
                <span>{book.scenes} scene{book.scenes === 1 ? "" : "s"}</span>
              </div>
              <p className="library-dashboard-book-note">{book.notes}</p>
              <div className="library-dashboard-card-meta">
                <span>{formatLastUpdated(book.lastEdited)}</span>
                <button
                  className="library-dashboard-book-open"
                  onClick={() => router.push(`/library/${lib.libraryId}/books/${book.id}`)}
                >
                  Open →
                </button>
              </div>
            </article>
          ))}
          <button className="library-dashboard-book-card library-dashboard-book-card--new" onClick={handleNewBook}>
            + New Book
          </button>
        </div>
      </section>

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

      {searchOpen && (
        <div className="cmd-palette-overlay" onClick={() => setSearchOpen(false)}>
          <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
            <div className="cmd-palette-input-wrap">
              <span className="cmd-palette-chevron">›</span>
              <input
                ref={searchInputRef}
                className="cmd-palette-input"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setSelectedSearchIndex(0);
                }}
                placeholder="Search modules, books, entries..."
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedSearchIndex((index) =>
                      Math.max(0, Math.min(filteredSearchItems.length - 1, index + 1)),
                    );
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedSearchIndex((index) => Math.max(0, index - 1));
                  }
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (selectedSearchItem) handleSearchSelect(selectedSearchItem);
                  }
                  if (e.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
              />
            </div>
            <div className="cmd-palette-list">
              {filteredSearchItems.length === 0 ? (
                <div className="cmd-palette-empty">No matches found.</div>
              ) : (
                filteredSearchItems.map((item, index) => (
                  <button
                    key={item.id}
                    className={`cmd-palette-item${index === selectedSearchIndex ? " selected" : ""}`}
                    onClick={() => handleSearchSelect(item)}
                    onMouseEnter={() => setSelectedSearchIndex(index)}
                  >
                    <span className="cmd-palette-item-icon">{item.icon}</span>
                    <span className="cmd-palette-item-label">{item.label}</span>
                    <span className="cmd-palette-item-kbd">{item.hint}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
