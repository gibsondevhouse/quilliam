/**
 * Composition root for the Quilliam RAG persistence layer.
 *
 * This module assembles all domain sub-stores into a single `RAGStore` instance
 * and exposes the public API previously exported from `db.ts`.
 *
 * Public exports (used by `src/app/ClientShell.tsx`):
 *   createRAGStore()   — factory for the composed RAGStore
 *   checkStorageHealth() — IDB write probe
 *   getCorpusStats()   — record counts and size estimates
 */

import type { RAGStore } from "@/lib/rag/store";
import { getDb, DB_VERSION, libraryMetaKey, type QuillDB } from "./schema";
import { collectCascadeNodeIds, deleteEmbeddingForFragment } from "./helpers";
import { createNodeStore } from "./nodes";
import { createChatStore } from "./chat";
import { createGeneralThreadStore } from "./generalThreads";
import { createEntryStore } from "./entries";
import { createManuscriptStore } from "./manuscript";
import { createTimelineStore } from "./timeline";
import { createRelationStore } from "./relations";
import { createResearchStore } from "./research";
import { createMediaStore } from "./media";
import { createPatchStore } from "./patches";

// ---------------------------------------------------------------------------
// Cross-domain transaction operations
// These span multiple object stores and must stay together so they can hold
// a single IDB transaction across all affected stores.
// ---------------------------------------------------------------------------

async function deleteStoryCascade(db: QuillDB, id: string): Promise<void> {
  const nodeIds = await collectCascadeNodeIds(db, id);
  const tx = db.transaction(["stories", "nodes", "embeddings"], "readwrite");

  await tx.objectStore("stories").delete(id);
  for (const nodeId of nodeIds) {
    await tx.objectStore("nodes").delete(nodeId);
    await deleteEmbeddingForFragment(tx, nodeId);
  }

  await tx.done;
}

async function deleteLibraryCascade(db: QuillDB, libraryId: string): Promise<void> {
  const nodeIds = await collectCascadeNodeIds(db, libraryId);
  const tx = db.transaction(
    [
      "nodes",
      "embeddings",
      "metadata",
      "chatSessions",
      "chatMessages",
      "characters",
      "locations",
      "worldEntries",
      "stories",
      "aiSettings",
      "researchRuns",
      "researchArtifacts",
      "usageLedgers",
      "universes",
      "entries",
      "series",
      "books",
      "chapters",
      "scenes",
      "entryRelations",
      "timelines",
      "eras",
      "events",
      "calendars",
      "timeAnchors",
      "memberships",
      "cultureMemberships",
      "itemOwnerships",
      "mentions",
      "media",
      "maps",
      "mapPins",
      "cultureVersions",
      "organizationVersions",
      "religionVersions",
      "continuityIssues",
      "suggestions",
      "revisions",
      "entryPatches",
      "entryPatchByEntry",
    ],
    "readwrite",
  );

  for (const nodeId of nodeIds) {
    await tx.objectStore("nodes").delete(nodeId);
    await deleteEmbeddingForFragment(tx, nodeId);
  }

  await tx.objectStore("metadata").delete(libraryMetaKey(libraryId));
  await tx.objectStore("aiSettings").delete(libraryId);

  const sessionsByLibrary = tx.objectStore("chatSessions").index("by_library");
  let sessionCursor = await sessionsByLibrary.openCursor(libraryId);
  while (sessionCursor) {
    const sessionId = sessionCursor.value.id;
    await sessionCursor.delete();
    let messageCursor = await tx.objectStore("chatMessages").index("by_session").openCursor(sessionId);
    while (messageCursor) {
      await messageCursor.delete();
      messageCursor = await messageCursor.continue();
    }
    sessionCursor = await sessionCursor.continue();
  }

  const deleteByLibrary = async (
    storeName: "characters" | "locations" | "worldEntries" | "stories",
  ): Promise<void> => {
    const index = tx.objectStore(storeName).index("by_library");
    let cursor = await index.openCursor(libraryId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  };

  await deleteByLibrary("characters");
  await deleteByLibrary("locations");
  await deleteByLibrary("worldEntries");
  await deleteByLibrary("stories");

  const runsByLibrary = tx.objectStore("researchRuns").index("by_library");
  let runCursor = await runsByLibrary.openCursor(libraryId);
  while (runCursor) {
    const runId = runCursor.value.id;
    await runCursor.delete();
    await tx.objectStore("usageLedgers").delete(runId);

    const artifactsByRun = tx.objectStore("researchArtifacts").index("by_run");
    let artifactCursor = await artifactsByRun.openCursor(runId);
    while (artifactCursor) {
      await artifactCursor.delete();
      artifactCursor = await artifactCursor.continue();
    }
    runCursor = await runCursor.continue();
  }

  const entryRows = await tx.objectStore("entries").index("by_universe").getAll(libraryId);
  const bookRows = await tx.objectStore("books").index("by_universe").getAll(libraryId);
  const mapRows = await tx.objectStore("maps").index("by_universe").getAll(libraryId);
  const timelineRows = await tx.objectStore("timelines").index("by_universe").getAll(libraryId);
  const calendarRows = await tx.objectStore("calendars").index("by_universe").getAll(libraryId);
  const eventRows = await tx.objectStore("events").index("by_universe").getAll(libraryId);
  const entryIds = new Set(entryRows.map((row) => row.id));
  const sceneIds = new Set<string>(entryRows.filter((row) => row.entryType === "scene").map((row) => row.id));
  const mapIds = new Set(mapRows.map((row) => row.id));
  const bookIds = new Set(bookRows.map((row) => row.id));
  const timelineIds = new Set(timelineRows.map((row) => row.id));
  const calendarIds = new Set(calendarRows.map((row) => row.id));
  const cultureEntryIds = new Set(entryRows.filter((row) => row.entryType === "culture").map((row) => row.id));
  const patchIdsToDelete = new Set<string>();
  const timeAnchorIdsToDelete = new Set<string>(eventRows.map((row) => row.timeAnchorId).filter(Boolean));
  const chapterIds = new Set<string>();

  const deleteByUniverse = async (
    storeName:
      | "entries"
      | "series"
      | "books"
      | "timelines"
      | "events"
      | "calendars"
      | "media"
      | "maps"
      | "continuityIssues"
      | "suggestions"
      | "revisions",
  ): Promise<void> => {
    const index = tx.objectStore(storeName).index("by_universe");
    let cursor = await index.openCursor(libraryId);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
    }
  };

  const deleteByIndex = async (
    storeName:
      | "entryRelations"
      | "mentions"
      | "cultureVersions"
      | "organizationVersions"
      | "religionVersions"
      | "eras"
      | "timeAnchors"
      | "entryPatchByEntry"
      | "memberships"
      | "cultureMemberships"
      | "itemOwnerships"
      | "mapPins"
      | "chapters"
      | "scenes",
    indexName:
      | "by_from"
      | "by_to"
      | "by_scene"
      | "by_entry"
      | "by_culture"
      | "by_organization"
      | "by_religion"
      | "by_timeline"
      | "by_calendar"
      | "by_character"
      | "by_item"
      | "by_owner"
      | "by_map"
      | "by_book"
      | "by_chapter",
    value: string,
    beforeDelete?: (cursorValue: { patchId?: string }) => void,
  ): Promise<void> => {
    type GenericCursor = {
      value: unknown;
      delete(): Promise<void>;
      continue(): Promise<GenericCursor | null>;
    };
    const store = tx.objectStore(storeName) as unknown as {
      index(name: string): { openCursor(query: string): Promise<GenericCursor | null> };
    };
    const index = store.index(indexName);
    let cursor = await index.openCursor(value);
    while (cursor) {
      if (beforeDelete) beforeDelete(cursor.value as { patchId?: string });
      await cursor.delete();
      cursor = await cursor.continue();
    }
  };

  for (const entryId of entryIds) {
    await deleteByIndex("entryRelations", "by_from", entryId);
    await deleteByIndex("entryRelations", "by_to", entryId);
    await deleteByIndex("mentions", "by_entry", entryId);
    await deleteByIndex("memberships", "by_character", entryId);
    await deleteByIndex("memberships", "by_organization", entryId);
    await deleteByIndex("cultureMemberships", "by_character", entryId);
    await deleteByIndex("cultureMemberships", "by_culture", entryId);
    await deleteByIndex("itemOwnerships", "by_item", entryId);
    await deleteByIndex("itemOwnerships", "by_owner", entryId);
    await deleteByIndex("organizationVersions", "by_organization", entryId);
    await deleteByIndex("religionVersions", "by_religion", entryId);
    await deleteByIndex("mapPins", "by_entry", entryId);
    await deleteByIndex("entryPatchByEntry", "by_entry", entryId, (row) => {
      if (row.patchId) patchIdsToDelete.add(row.patchId);
    });
  }

  for (const mapId of mapIds) {
    await deleteByIndex("mapPins", "by_map", mapId);
  }

  for (const bookId of bookIds) {
    const rows = await tx.objectStore("chapters").index("by_book").getAll(bookId);
    for (const row of rows) chapterIds.add(row.id);
    await deleteByIndex("chapters", "by_book", bookId);
  }

  for (const chapterId of chapterIds) {
    const rows = await tx.objectStore("scenes").index("by_chapter").getAll(chapterId);
    for (const row of rows) sceneIds.add(row.id);
    await deleteByIndex("scenes", "by_chapter", chapterId);
  }

  for (const sceneId of sceneIds) {
    await deleteByIndex("mentions", "by_scene", sceneId);
  }

  for (const cultureEntryId of cultureEntryIds) {
    await deleteByIndex("cultureVersions", "by_culture", cultureEntryId);
  }

  for (const timelineId of timelineIds) {
    await deleteByIndex("eras", "by_timeline", timelineId);
  }

  for (const calendarId of calendarIds) {
    await deleteByIndex("timeAnchors", "by_calendar", calendarId);
  }

  for (const timeAnchorId of timeAnchorIdsToDelete) {
    await tx.objectStore("timeAnchors").delete(timeAnchorId);
  }

  for (const patchId of patchIdsToDelete) {
    await tx.objectStore("entryPatches").delete(patchId);
  }

  await deleteByUniverse("entries");
  await deleteByUniverse("series");
  await deleteByUniverse("books");
  await deleteByUniverse("timelines");
  await deleteByUniverse("events");
  await deleteByUniverse("calendars");
  await deleteByUniverse("media");
  await deleteByUniverse("maps");
  await deleteByUniverse("continuityIssues");
  await deleteByUniverse("suggestions");
  await deleteByUniverse("revisions");

  await tx.objectStore("universes").delete(libraryId);

  await tx.done;
}

async function checkSchemaVersion(
  db: QuillDB,
): Promise<{ needsMigration: boolean; storedVersion: number | null }> {
  const record = await db.get("metadata", "schemaVersion");
  const storedVersion = record ? (record.value as number) : null;
  return {
    needsMigration: storedVersion !== null && storedVersion < DB_VERSION,
    storedVersion,
  };
}

// ---------------------------------------------------------------------------
// Public factory
// ---------------------------------------------------------------------------

/**
 * Factory to obtain a `RAGStore` backed by IndexedDB.
 * The returned object is safe to cache for the lifetime of the page.
 */
export async function createRAGStore(): Promise<RAGStore> {
  const db = await getDb();
  return {
    ...createNodeStore(db),
    ...createChatStore(db),
    ...createGeneralThreadStore(db),
    ...createEntryStore(db),
    ...createManuscriptStore(db),
    ...createTimelineStore(db),
    ...createRelationStore(db),
    ...createResearchStore(db),
    ...createMediaStore(db),
    ...createPatchStore(db),
    checkSchemaVersion: () => checkSchemaVersion(db),
    deleteLibraryCascade: (id: string) => deleteLibraryCascade(db, id),
    deleteStoryCascade: (id: string) => deleteStoryCascade(db, id),
  };
}

// ---------------------------------------------------------------------------
// Storage health & corpus-scale utilities
// ---------------------------------------------------------------------------

/**
 * Record counts and estimated byte sizes for the IDB corpus.
 */
export interface CorpusStats {
  nodeCount: number;
  fragmentCount: number;
  embeddingCount: number;
  estimatedBytes: number;
  /** True when fragment + embedding counts approach the 10k-record threshold. */
  nearPerformanceCliff: boolean;
}

export async function getCorpusStats(): Promise<CorpusStats> {
  const db = await getDb();
  const [nodeCount, embeddingCount] = await Promise.all([
    db.count("nodes"),
    db.count("embeddings"),
  ]);

  const allNodes = await db.getAll("nodes");
  const fragmentCount = allNodes.filter((n) => n.type === "fragment").length;

  const estimatedBytes =
    embeddingCount * (768 * 4 + 100) +
    nodeCount * 2048;

  const nearPerformanceCliff = fragmentCount + embeddingCount > 7_000;

  return { nodeCount, fragmentCount, embeddingCount, estimatedBytes, nearPerformanceCliff };
}

/**
 * Probe write to verify IDB is writable (Safari private mode guard).
 */
export type StorageHealthStatus = "ok" | "privateMode" | "unavailable";

export async function checkStorageHealth(): Promise<StorageHealthStatus> {
  if (typeof indexedDB === "undefined") return "unavailable";

  try {
    const db = await getDb();
    await db.put("metadata", {
      key: "__storage-health-probe__",
      value: 1,
      updatedAt: Date.now(),
    });
    return "ok";
  } catch (err) {
    if (err instanceof DOMException && err.name === "QuotaExceededError") {
      return "privateMode";
    }
    return "unavailable";
  }
}

// Re-export for consumers that import from "@/lib/rag/db" (unchanged import path)
export type { RAGStore } from "@/lib/rag/store";
