import type {
  Entry,
  Event,
  Relationship,
  Revision,
  Suggestion,
  Timeline,
  Universe,
} from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";
import {
  ensureEntryCompatibilityFields,
  mapLegacyCharacterToEntry,
  mapLegacyLocationToEntry,
  mapLegacyWorldEntryToEntry,
} from "@/lib/domain/mappers";

export interface Imp002MigrationReport {
  libraryId: string;
  universeId: string;
  stagedAt: number;
  entryCount: number;
  relationCount: number;
  timelineCount: number;
  eventCount: number;
  seededIssues: number;
  seededSuggestions: number;
  revisionCount: number;
  warnings: string[];
  status: "staged_complete";
}

interface SnapshotPayload {
  libraryId: string;
  capturedAt: number;
  canonicalDocIds: string[];
  legacyCharacterIds: string[];
  legacyLocationIds: string[];
  legacyWorldEntryIds: string[];
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

async function snapshotLegacyState(store: RAGStore, libraryId: string): Promise<SnapshotPayload> {
  const [legacyChars, legacyLocs, legacyWorld, canonicalDocs] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
    Promise.all([
      store.queryDocsByType("character"),
      store.queryDocsByType("location"),
      store.queryDocsByType("faction"),
      store.queryDocsByType("magic_system"),
      store.queryDocsByType("item"),
      store.queryDocsByType("lore_entry"),
      store.queryDocsByType("rule"),
      store.queryDocsByType("scene"),
      store.queryDocsByType("timeline_event"),
      store.queryDocsByType("culture"),
      store.queryDocsByType("organization"),
      store.queryDocsByType("system"),
      store.queryDocsByType("language"),
      store.queryDocsByType("religion"),
      store.queryDocsByType("lineage"),
      store.queryDocsByType("economy"),
    ]).then((groups) => groups.flat()),
  ]);

  const snapshot: SnapshotPayload = {
    libraryId,
    capturedAt: Date.now(),
    canonicalDocIds: canonicalDocs.map((doc) => doc.id),
    legacyCharacterIds: legacyChars.map((row) => row.id),
    legacyLocationIds: legacyLocs.map((row) => row.id),
    legacyWorldEntryIds: legacyWorld.map((row) => row.id),
  };

  await store.setMetadata({
    key: `imp002:migration:${libraryId}:snapshot`,
    value: snapshot,
    updatedAt: Date.now(),
  });

  return snapshot;
}

async function ensureUniverse(store: RAGStore, libraryId: string): Promise<Universe> {
  const existing = await store.getUniverse(libraryId);
  if (existing) return existing;

  const meta = await store.getLibraryMeta(libraryId);
  const ragNode = await store.getNode(libraryId);
  const now = Date.now();
  const universe: Universe = {
    id: libraryId,
    name: meta?.title || ragNode?.title || "Untitled Universe",
    tagline: meta?.description || "",
    overviewMd: meta?.description || "",
    defaultCalendarId: undefined,
    createdAt: now,
    updatedAt: now,
  };
  await store.putUniverse(universe);
  return universe;
}

async function migrateEntries(store: RAGStore, libraryId: string, universeId: string): Promise<{ entries: Entry[]; warnings: string[] }> {
  const warnings: string[] = [];
  const entries = new Map<string, Entry>();

  const [legacyChars, legacyLocs, legacyWorld] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
  ]);

  for (const character of legacyChars) {
    const entry = mapLegacyCharacterToEntry(character, universeId);
    entries.set(entry.id, entry);
  }

  for (const location of legacyLocs) {
    const entry = mapLegacyLocationToEntry(location, universeId);
    entries.set(entry.id, entry);
  }

  for (const world of legacyWorld) {
    const entry = mapLegacyWorldEntryToEntry(world, universeId);
    entries.set(entry.id, entry);
  }

  const canonicalTypes: Array<
    | "character"
    | "location"
    | "faction"
    | "magic_system"
    | "item"
    | "lore_entry"
    | "rule"
    | "scene"
    | "timeline_event"
    | "culture"
    | "organization"
    | "system"
    | "language"
    | "religion"
    | "lineage"
    | "economy"
  > = [
    "character",
    "location",
    "faction",
    "magic_system",
    "item",
    "lore_entry",
    "rule",
    "scene",
    "timeline_event",
    "culture",
    "organization",
    "system",
    "language",
    "religion",
    "lineage",
    "economy",
  ];

  for (const type of canonicalTypes) {
    const docs = await store.queryDocsByType(type);
    for (const doc of docs) {
      const entry = ensureEntryCompatibilityFields({
        ...doc,
        universeId: doc.universeId || universeId,
      });
      entries.set(entry.id, entry);
    }
  }

  for (const entry of entries.values()) {
    if (!entry.name) warnings.push(`Entry ${entry.id} has empty name.`);
    await store.addEntry({ ...entry, universeId });
  }

  return { entries: [...entries.values()], warnings };
}

async function seedTimelineAndEvents(store: RAGStore, universeId: string, entries: Entry[]): Promise<{ timelines: Timeline[]; events: Event[] }> {
  const timelineId = `tml_master_${universeId}`;
  const timeline: Timeline = {
    id: timelineId,
    universeId,
    bookId: undefined,
    timelineType: "master",
    name: "Master Timeline",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await store.putTimeline(timeline);

  const events: Event[] = [];
  const eventEntries = entries.filter((entry) => entry.entryType === "timeline_event");
  for (const eventEntry of eventEntries) {
    const event: Event = {
      id: eventEntry.id,
      universeId,
      timeAnchorId: String(eventEntry.details.timeAnchorId ?? eventEntry.details.time_anchor_id ?? ""),
      eraId: undefined,
      name: eventEntry.name,
      eventType: String(eventEntry.details.eventType ?? "timeline_event"),
      descriptionMd: eventEntry.bodyMd ?? eventEntry.summary,
      createdAt: eventEntry.createdAt,
      updatedAt: eventEntry.updatedAt,
    };
    events.push(event);
    await store.putEvent(event);
  }

  return { timelines: [timeline], events };
}

async function seedRevisions(store: RAGStore, universeId: string, entries: Entry[], relations: Relationship[]): Promise<number> {
  let count = 0;
  for (const entry of entries) {
    const revision: Revision = {
      id: makeId("rev"),
      universeId,
      targetType: "entry",
      targetId: entry.id,
      authorId: undefined,
      createdAt: Date.now(),
      patch: { op: "seed", source: "imp002-migration" },
      message: "Seeded by imp-plan-002 migration",
    };
    await store.addRevision(revision);
    count++;
  }

  for (const relation of relations) {
    const revision: Revision = {
      id: makeId("rev"),
      universeId,
      targetType: "relation",
      targetId: relation.id,
      authorId: undefined,
      createdAt: Date.now(),
      patch: { op: "seed-relation", source: "imp002-migration" },
      message: "Relation seeded by imp-plan-002 migration",
    };
    await store.addRevision(revision);
    count++;
  }

  return count;
}

async function seedInitialSuggestions(store: RAGStore, universeId: string): Promise<Suggestion[]> {
  const now = Date.now();
  const suggestions: Suggestion[] = [
    {
      id: makeId("sgg"),
      universeId,
      targetType: "timeline",
      targetId: `tml_master_${universeId}`,
      proposedChange: { op: "review-master-timeline" },
      status: "pending",
      origin: "ai",
      confidence: 0.5,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: makeId("sgg"),
      universeId,
      targetType: "culture",
      targetId: "*",
      proposedChange: { op: "seed-culture-versions" },
      status: "pending",
      origin: "ai",
      confidence: 0.45,
      createdAt: now,
      updatedAt: now,
    },
  ];

  for (const suggestion of suggestions) {
    await store.addSuggestion(suggestion);
  }

  return suggestions;
}

export async function migrateImp002Library(
  store: RAGStore,
  libraryId: string,
): Promise<Imp002MigrationReport> {
  await snapshotLegacyState(store, libraryId);
  const universe = await ensureUniverse(store, libraryId);

  const { entries, warnings } = await migrateEntries(store, libraryId, universe.id);

  const relationMap = new Map<string, Relationship>();
  for (const entry of entries) {
    const rels = await store.getRelationsForDoc(entry.id);
    for (const rel of rels) relationMap.set(rel.id, rel);
  }

  for (const relation of relationMap.values()) {
    await store.addEntryRelation(relation);
  }

  const { timelines, events } = await seedTimelineAndEvents(store, universe.id, entries);
  const revisionCount = await seedRevisions(store, universe.id, entries, [...relationMap.values()]);
  const suggestions = await seedInitialSuggestions(store, universe.id);

  await store.setMetadata({
    key: `imp002:migration:${libraryId}:state`,
    value: {
      status: "staged_complete",
      universeId: universe.id,
      stagedAt: Date.now(),
    },
    updatedAt: Date.now(),
  });

  const report: Imp002MigrationReport = {
    libraryId,
    universeId: universe.id,
    stagedAt: Date.now(),
    entryCount: entries.length,
    relationCount: relationMap.size,
    timelineCount: timelines.length,
    eventCount: events.length,
    seededIssues: 0,
    seededSuggestions: suggestions.length,
    revisionCount,
    warnings,
    status: "staged_complete",
  };

  await store.setMetadata({
    key: `imp002:migration:${libraryId}:report`,
    value: report,
    updatedAt: Date.now(),
  });

  return report;
}

export async function finalizeImp002Migration(store: RAGStore, libraryId: string): Promise<void> {
  const state = await store.getMetadata<{ status?: string }>(`imp002:migration:${libraryId}:state`);
  if (!state || state.status !== "staged_complete") {
    throw new Error("imp002 migration is not staged_complete for this library.");
  }

  // Purge legacy authoring stores for this library after explicit finalize.
  // Canonical/entry stores are preserved (active data path).
  const [legacyChars, legacyLocs, legacyWorld] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
  ]);

  for (const row of legacyChars) {
    await store.deleteCharacter(row.id);
  }
  for (const row of legacyLocs) {
    await store.deleteLocation(row.id);
  }
  for (const row of legacyWorld) {
    await store.deleteWorldEntry(row.id);
  }

  const now = Date.now();
  await store.setMetadata({
    key: `imp002:migration:${libraryId}:state`,
    value: {
      status: "finalized",
      universeId: libraryId,
      finalizedAt: now,
    },
    updatedAt: now,
  });

  await store.setMetadata({
    key: `imp002:migration:${libraryId}:finalized`,
    value: {
      libraryId,
      finalizedAt: now,
      purged: {
        characters: legacyChars.length,
        locations: legacyLocs.length,
        worldEntries: legacyWorld.length,
      },
    },
    updatedAt: now,
  });
}

export async function getImp002MigrationState(
  store: RAGStore,
  libraryId: string,
): Promise<{ status?: string; universeId?: string; stagedAt?: number } | null> {
  return store.getMetadata<{ status?: string; universeId?: string; stagedAt?: number }>(
    `imp002:migration:${libraryId}:state`,
  );
}
