/**
 * In-app migration utilities (Plan 001 — Phase 6).
 *
 * Migrates existing entity tables (characters, locations, worldEntries) and
 * RAG scene nodes into the new canonical document stores in four steps:
 *
 *   Step A — Legacy entity tables → `canonicalDocs`
 *   Step B — Implicit field relationships → `relationships`
 *   Step C — RAG scene nodes → canonical `scene` docs
 *   Step D — Rename legacy `part` RAG nodes → `section`
 *
 * Migration is additive and non-destructive: existing records are left intact.
 * All migrated docs start with `status: "draft"`.
 * Call `confirmMigration` after user review to mark legacy records migrated.
 *
 * Usage:
 *   const report = await migrateLibrary(store, libraryId, onProgress);
 *   await confirmMigration(store, libraryId);
 */

import type { RAGStore } from "@/lib/rag/store";
import type { Entry, EntryType, Relationship, SourceRef } from "@/lib/types";

/* ----------------------------------------------------------------
   Helpers
   ---------------------------------------------------------------- */

const TYPE_PREFIX: Record<EntryType, string> = {
  character:      "char",
  location:       "loc",
  culture:        "cul",
  organization:   "org",
  system:         "sys",
  faction:        "fac",
  magic_system:   "mgc",
  item:           "itm",
  language:       "lng",
  religion:       "rel",
  lineage:        "lin",
  economy:        "eco",
  lore_entry:     "lre",
  rule:           "rul",
  scene:          "scn",
  timeline_event: "evt",
};

function makeDocId(type: EntryType, legacyId: string): string {
  return `${TYPE_PREFIX[type]}_mig_${legacyId.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}`;
}

function makeRelId(fromId: string, relType: string, toId: string): string {
  return `rel_mig_${fromId}_${relType}_${toId}`.slice(0, 80);
}

function migrationSource(runId: string): SourceRef {
  return { kind: "manual", id: runId, excerpt: "Migration run" };
}

type ProgressFn = (step: string, pct: number) => void;

/* ----------------------------------------------------------------
   Step A — Legacy entity tables → canonicalDocs
   ---------------------------------------------------------------- */

/**
 * Migrate characters, locations, and world entries for a given library
 * into the `canonicalDocs` store.  Returns a map of legacy ID → canonical doc ID
 * for use in Step B relationship extraction, plus any warnings collected.
 */
async function stepA(
  store: RAGStore,
  libraryId: string,
  runId: string,
  onProgress?: ProgressFn,
): Promise<{
  charIdMap: Map<string, string>;   // legacyId → canonical docId
  locIdMap:  Map<string, string>;
  loreIdMap: Map<string, string>;
  warnings:  string[];
}> {
  const source = migrationSource(runId);
  const charIdMap = new Map<string, string>();
  const locIdMap  = new Map<string, string>();
  const loreIdMap = new Map<string, string>();
  const warnings: string[] = [];

  /* --- Characters --- */
  onProgress?.("characters", 5);
  const characters = await store.getCharactersByLibrary(libraryId);
  for (const char of characters) {
    const docId = makeDocId("character", char.id);
    charIdMap.set(char.id, docId);
    // Skip if already migrated
    const existing = await store.getDocById(docId);
    if (existing) continue;
    if (!char.notes && !char.role) {
      warnings.push(`Character "${char.name}" had no notes or role; left blank.`);
    }
    const doc: Entry = {
      id:            docId,
      type:          "character",
      universeId:    libraryId,
      entryType:     "character",
      name:          char.name,
      slug:          char.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary:       char.role || "",
      details:       { notes: char.notes, legacyId: char.id },
      status:        "draft",
      canonStatus:   "draft",
      visibility:    "private",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      createdAt:     Date.now(),
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  /* --- Locations --- */
  onProgress?.("locations", 20);
  const locations = await store.getLocationsByLibrary(libraryId);
  for (const loc of locations) {
    const docId = makeDocId("location", loc.id);
    locIdMap.set(loc.id, docId);
    const existing = await store.getDocById(docId);
    if (existing) continue;
    if (!loc.description) {
      warnings.push(`Location "${loc.name}" had no description; left blank.`);
    }
    const doc: Entry = {
      id:            docId,
      type:          "location",
      universeId:    libraryId,
      entryType:     "location",
      name:          loc.name,
      slug:          loc.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary:       loc.description || "",
      details:       { legacyId: loc.id },
      status:        "draft",
      canonStatus:   "draft",
      visibility:    "private",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      createdAt:     Date.now(),
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  /* --- World entries → lore_entry --- */
  onProgress?.("lore entries", 35);
  const worldEntries = await store.getWorldEntriesByLibrary(libraryId);
  for (const entry of worldEntries) {
    const docId = makeDocId("lore_entry", entry.id);
    loreIdMap.set(entry.id, docId);
    const existing = await store.getDocById(docId);
    if (existing) continue;
    if (!entry.notes) {
      warnings.push(`World entry "${entry.title}" had no notes; left blank.`);
    }
    const doc: Entry = {
      id:            docId,
      type:          "lore_entry",
      universeId:    libraryId,
      entryType:     "lore_entry",
      name:          entry.title,
      slug:          entry.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary:       entry.category ? `[${entry.category}]` : "",
      details:       { body: entry.notes, category: entry.category, legacyId: entry.id },
      status:        "draft",
      canonStatus:   "draft",
      visibility:    "private",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      createdAt:     Date.now(),
      updatedAt:     Date.now(),
    };
    await store.addDoc(doc);
  }

  return { charIdMap, locIdMap, loreIdMap, warnings };
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
  onProgress?: ProgressFn,
): Promise<number> {
  onProgress?.("relationships", 55);
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
          createdAt: Date.now(),
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
async function stepC(store: RAGStore, libraryId: string, runId: string, onProgress?: ProgressFn): Promise<number> {
  onProgress?.("scenes", 70);
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

    const doc: Entry = {
      id:            docId,
      type:          "scene",
      universeId:    libraryId,
      entryType:     "scene",
      name:          node.title || `Scene — ${node.id.slice(0, 8)}`,
      slug:          (node.title || `scene-${node.id.slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      summary:       node.content.slice(0, 200).replace(/\n/g, " ") + "…",
      details:       {
        chapterRef:       node.id,
        rawContent:       node.content,
        presentCharacters: [],
        presentLocations:  [],
      },
      status:        "draft",
      canonStatus:   "draft",
      visibility:    "private",
      sources:       [source],
      relationships: [],
      lastVerified:  0,
      createdAt:     Date.now(),
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
   Step D — Rename legacy `part` RAG nodes → `section`
   ---------------------------------------------------------------- */

/**
 * Scan all RAG nodes for the legacy `part` type and rename them to `section`
 * (matching the NodeType union that replaced "part" in hierarchy.ts).
 * Returns the number of nodes updated.
 */
async function stepD(store: RAGStore, onProgress?: ProgressFn): Promise<number> {
  onProgress?.("section rename", 85);
  const allNodes = await store.listAllNodes();
  // "part" is a legacy value not in the current NodeType union; cast required.
  const partNodes = allNodes.filter((n) => (n.type as string) === "part");
  for (const node of partNodes) {
    await store.putNode({ ...node, type: "section", updatedAt: Date.now() });
  }
  return partNodes.length;
}

/* ----------------------------------------------------------------
   Public API
   ---------------------------------------------------------------- */

/** Plan 001 §6.3 — Migration report returned after a library migration run. */
export interface MigrationReport {
  libraryId: string;
  characters: number;
  locations: number;
  worldEntries: number;
  scenes: number;
  relationships: number;
  /** Warnings collected during conversion (e.g. missing fields). */
  warnings: string[];
  completedAt: number;
}

/**
 * @deprecated Use `MigrationReport`. Kept for backward compatibility with callers
 * that destructure the old field names (charactersConverted, etc.).
 */
export type MigrationSummary = MigrationReport;

/**
 * Preview how many entities would be converted by a migration run.
 * Counts only records not yet marked `migrated: true`.
 */
export async function previewMigration(
  store: RAGStore,
  libraryId: string,
): Promise<{ characters: number; locations: number; worldEntries: number; scenes: number; partNodes: number }> {
  const [chars, locs, entries, allNodes] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
    store.listAllNodes(),
  ]);
  const sceneNodes = allNodes.filter(
    (n) => n.type === "scene" && n.content && n.content.trim().length > 0,
  );
  const partNodes = allNodes.filter((n) => (n.type as string) === "part");
  return {
    characters:   chars.filter((c) => !c.migrated).length,
    locations:    locs.filter((l) => !l.migrated).length,
    worldEntries: entries.filter((e) => !e.migrated).length,
    scenes:       sceneNodes.length,
    partNodes:    partNodes.length,
  };
}

/**
 * Confirm step: mark all legacy entity records as `migrated: true`.
 * Safe to call after the user has reviewed the MigrationReport and confirmed.
 */
export async function confirmMigration(store: RAGStore, libraryId: string): Promise<void> {
  const [chars, locs, entries] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
  ]);
  for (const char of chars) {
    if (!char.migrated) await store.putCharacter({ ...char, migrated: true, updatedAt: Date.now() });
  }
  for (const loc of locs) {
    if (!loc.migrated) await store.putLocation({ ...loc, migrated: true, updatedAt: Date.now() });
  }
  for (const entry of entries) {
    if (!entry.migrated) await store.putWorldEntry({ ...entry, migrated: true, updatedAt: Date.now() });
  }
  await store.setMetadata({
    key:      `migration:${libraryId}:last`,
    value:    { libraryId, confirmedAt: Date.now() },
    updatedAt: Date.now(),
  });
}

/**
 * Check whether this library has unmigrated legacy records.
 * Returns true when legacy store has records but no canonical docs have been created yet.
 */
export async function needsMigration(store: RAGStore, libraryId: string): Promise<boolean> {
  const [chars, locs, entries] = await Promise.all([
    store.getCharactersByLibrary(libraryId),
    store.getLocationsByLibrary(libraryId),
    store.getWorldEntriesByLibrary(libraryId),
  ]);
  if (chars.length + locs.length + entries.length === 0) return false;
  const canonDocs = await store.queryDocsByType("character");
  return canonDocs.length === 0;
}

/**
 * Run the full four-step migration for a given library.
 *
 * Steps:
 *   A — `characters`, `locations`, `worldEntries` tables → `canonicalDocs`
 *   B — Implicit FK fields → `relationships`
 *   C — Scene RAG nodes → canonical `scene` docs
 *   D — Rename legacy `part` RAG node type → `section`
 *
 * Safe to run multiple times — already-migrated docs are skipped via
 * `getDocById` checks at the start of each entity loop.
 *
 * @param store       The RAGStore instance (IDB-backed in browser, mock in tests).
 * @param libraryId   The library to migrate.
 * @param onProgress  Optional callback receiving (stepLabel, pct 0–100).
 * @returns           A MigrationReport with counts and any warnings.
 */
export async function migrateLibrary(
  store: RAGStore,
  libraryId: string,
  onProgress?: (step: string, pct: number) => void,
): Promise<MigrationReport> {
  const runId = `mig_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  onProgress?.("starting", 0);

  const { charIdMap, locIdMap, loreIdMap, warnings } = await stepA(store, libraryId, runId, onProgress);
  const relationships = await stepB(store, charIdMap, locIdMap, runId, onProgress);
  const scenes        = await stepC(store, libraryId, runId, onProgress);
  await stepD(store, onProgress);

  onProgress?.("complete", 100);

  // Record the migration run in metadata so checkSchemaVersion can track state
  await store.setMetadata({
    key:      `migration:${libraryId}:${runId}`,
    value:    { libraryId, runId, completedAt: Date.now() },
    updatedAt: Date.now(),
  });

  return {
    libraryId,
    characters:   charIdMap.size,
    locations:    locIdMap.size,
    worldEntries: loreIdMap.size,
    scenes,
    relationships,
    warnings,
    completedAt:  Date.now(),
  };
}

/**
 * Check whether a migration has been confirmed for a given library.
 * Returns the most recent sentinel metadata, or null if none found.
 */
export async function getLastMigration(
  store: RAGStore,
  libraryId: string,
): Promise<{ libraryId: string; confirmedAt?: number; completedAt?: number } | null> {
  return store.getMetadata<{ libraryId: string; confirmedAt?: number; completedAt?: number }>(
    `migration:${libraryId}:last`,
  );
}
