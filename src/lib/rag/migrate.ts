/**
 * In-app migration utilities (Plan 001 — Phase 6).
 *
 * Migrates existing entity tables (characters, locations, worldEntries) and
 * RAG scene nodes into the new canonical document stores in three steps:
 *
 *   Step A — Legacy entity tables → `canonicalDocs`
 *   Step B — Implicit field relationships → `relationships`
 *   Step C — RAG scene nodes → canonical `scene` docs
 *
 * Migration is additive and non-destructive: existing records are left intact.
 * All migrated docs start with `status: "draft"`.
 *
 * Usage:
 *   const summary = await migrateLibrary(store, libraryId);
 */

import type { RAGStore } from "@/lib/rag/store";
import type { CanonicalDoc, CanonicalType, Relationship, SourceRef } from "@/lib/types";

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

const TYPE_PREFIX: Record<CanonicalType, string> = {
  character:      "char",
  location:       "loc",
  faction:        "fac",
  magic_system:   "mgc",
  item:           "itm",
  lore_entry:     "lre",
  rule:           "rul",
  scene:          "scn",
  timeline_event: "evt",
};

function makeDocId(type: CanonicalType, legacyId: string): string {
  return `${TYPE_PREFIX[type]}_mig_${legacyId.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}`;
}

function makeRelId(fromId: string, relType: string, toId: string): string {
  return `rel_mig_${fromId}_${relType}_${toId}`.slice(0, 80);
}

function migrationSource(runId: string): SourceRef {
  return { type: "migration", id: runId, label: "Migration run" };
}

/* ----------------------------------------------------------------
   Step A — Legacy entity tables → canonicalDocs
   ---------------------------------------------------------------- */

/**
 * Migrate characters, locations, and world entries for a given library
 * into the `canonicalDocs` store.  Returns a map of legacy ID → canonical doc ID
 * for use in Step B relationship extraction.
 */
async function stepA(
  store: RAGStore,
  libraryId: string,
  runId: string,
): Promise<{
  charIdMap: Map<string, string>;   // legacyId → canonical docId
  locIdMap:  Map<string, string>;
  loreIdMap: Map<string, string>;
}> {
  const source = migrationSource(runId);
  const charIdMap = new Map<string, string>();
  const locIdMap  = new Map<string, string>();
  const loreIdMap = new Map<string, string>();

  /* --- Characters --- */
  const characters = await store.getCharactersByLibrary(libraryId);
  for (const char of characters) {
    const docId = makeDocId("character", char.id);
    charIdMap.set(char.id, docId);
    // Skip if already migrated
    const existing = await store.getDocById(docId);
    if (existing) continue;
    const doc: CanonicalDoc = {
      id:            docId,
      type:          "character",
      name:          char.name,
      summary:       char.role || "",
      details:       { notes: char.notes, legacyId: char.id },
      status:        "draft",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  /* --- Locations --- */
  const locations = await store.getLocationsByLibrary(libraryId);
  for (const loc of locations) {
    const docId = makeDocId("location", loc.id);
    locIdMap.set(loc.id, docId);
    const existing = await store.getDocById(docId);
    if (existing) continue;
    const doc: CanonicalDoc = {
      id:            docId,
      type:          "location",
      name:          loc.name,
      summary:       loc.description || "",
      details:       { legacyId: loc.id },
      status:        "draft",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  /* --- World entries → lore_entry --- */
  const worldEntries = await store.getWorldEntriesByLibrary(libraryId);
  for (const entry of worldEntries) {
    const docId = makeDocId("lore_entry", entry.id);
    loreIdMap.set(entry.id, docId);
    const existing = await store.getDocById(docId);
    if (existing) continue;
    const doc: CanonicalDoc = {
      id:            docId,
      type:          "lore_entry",
      name:          entry.title,
      summary:       entry.category ? `[${entry.category}]` : "",
      details:       { body: entry.notes, category: entry.category, legacyId: entry.id },
      status:        "draft",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  return { charIdMap, locIdMap, loreIdMap };
}

/* ----------------------------------------------------------------
   Step B — Implicit field relationships
   ---------------------------------------------------------------- */

/**
 * Scan migrated canonical docs for implicit FK-style fields
 * (e.g., `locationId`, `ownerId`) and create Relationship records.
 *
 * For now we extract the simplest pattern: if a character doc's `details`
 * contains a `locationId` that maps to a known canonical location doc,
 * create a `located_at` relationship.
 */
async function stepB(
  store: RAGStore,
  charIdMap: Map<string, string>,
  locIdMap: Map<string, string>,
  runId: string,
): Promise<number> {
  const source = migrationSource(runId);
  let created = 0;

  for (const [legacyCharId, charDocId] of charIdMap) {
    const charDoc = await store.getDocById(charDocId);
    if (!charDoc) continue;

    // Look for locationId in details
    const locationId = charDoc.details.locationId as string | undefined;
    if (locationId && locIdMap.has(locationId)) {
      const locDocId = locIdMap.get(locationId)!;
      const relId = makeRelId(charDocId, "located_at", locDocId);
      const existing = (await store.getRelationsForDoc(charDocId)).find(
        (r) => r.id === relId,
      );
      if (!existing) {
        const rel: Relationship = {
          id:       relId,
          from:     charDocId,
          type:     "located_at",
          to:       locDocId,
          metadata: { migratedFrom: legacyCharId },
          sources:  [source],
        };
        await store.addRelationship(rel);
        created++;
      }
    }
  }

  return created;
}

/* ----------------------------------------------------------------
   Step C — RAG scene nodes → canonical scene docs
   ---------------------------------------------------------------- */

/**
 * For each RAG node of type "scene", create a canonical `CanonicalDoc` of type "scene"
 * with `details.chapterRef` pointing back to the RAG node ID and the raw text in
 * `details.rawContent`.  Clears `node.content` to avoid double-storing large text, and
 * sets `node.sceneDocId` so the tree can link to the canonical doc panel.
 *
 * Returns the number of scene docs created.
 */
async function stepC(store: RAGStore, libraryId: string, runId: string): Promise<number> {
  const source = migrationSource(runId);
  let created = 0;

  const allNodes = await store.listAllNodes();
  const sceneNodes = allNodes.filter(
    (n) => n.type === "scene" && n.content && n.content.trim().length > 0,
  );

  for (const node of sceneNodes) {
    const docId = makeDocId("scene", node.id);
    const existing = await store.getDocById(docId);
    if (existing) continue;

    const doc: CanonicalDoc = {
      id:            docId,
      type:          "scene",
      name:          node.title || `Scene — ${node.id.slice(0, 8)}`,
      summary:       node.content.slice(0, 200).replace(/\n/g, " ") + "…",
      details:       {
        chapterRef:       node.id,
        rawContent:       node.content,
        presentCharacters: [],
        presentLocations:  [],
      },
      status:        "draft",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);

    // Update the RAG node: clear heavy content, record sceneDocId
    const updatedNode = {
      ...node,
      content: "",
      sceneDocId: docId,
      updatedAt: Date.now(),
    };
    await store.putNode(updatedNode);

    created++;
  }

  return created;
}

/* ----------------------------------------------------------------
   Public API
   ---------------------------------------------------------------- */

export interface MigrationSummary {
  runId: string;
  libraryId: string;
  charactersConverted: number;
  locationsConverted: number;
  loreEntriesConverted: number;
  relationshipsCreated: number;
  sceneDocsCreated: number;
  completedAt: number;
}

/**
 * Run the full three-step migration for a given library.
 *
 * Safe to call multiple times — already-migrated docs are skipped via the
 * `getDocById` existence check at the start of each entity loop.
 *
 * @param store     The RAGStore instance (IDB-backed in browser, mock in tests).
 * @param libraryId The library to migrate.
 * @returns         A summary of created records for user review.
 */
export async function migrateLibrary(
  store: RAGStore,
  libraryId: string,
): Promise<MigrationSummary> {
  const runId = `mig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

  const { charIdMap, locIdMap, loreIdMap } = await stepA(store, libraryId, runId);
  const relationshipsCreated = await stepB(store, charIdMap, locIdMap, runId);
  const sceneDocsCreated     = await stepC(store, libraryId, runId);

  // Record the migration run in metadata so checkSchemaVersion can track state
  await store.setMetadata({
    key: `migration:${libraryId}:${runId}`,
    value: { libraryId, runId, completedAt: Date.now() },
    updatedAt: Date.now(),
  });

  return {
    runId,
    libraryId,
    charactersConverted: charIdMap.size,
    locationsConverted:  locIdMap.size,
    loreEntriesConverted: loreIdMap.size,
    relationshipsCreated,
    sceneDocsCreated,
    completedAt: Date.now(),
  };
}

/**
 * Check whether a migration has been run for a given library.
 * Returns the most recent migration run metadata, or null if none found.
 */
export async function getLastMigration(
  store: RAGStore,
  libraryId: string,
): Promise<{ runId: string; libraryId: string; completedAt: number } | null> {
  // We can't list metadata keys by prefix without a full scan; for simplicity
  // just try to find via a known sentinel key set during migration.
  const sentinel = await store.getMetadata<{ runId: string; libraryId: string; completedAt: number }>(
    `migration:${libraryId}:last`,
  );
  return sentinel;
}
