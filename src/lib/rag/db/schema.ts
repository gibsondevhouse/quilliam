/**
 * IndexedDB schema definition and upgrade handler for the Quilliam RAG database.
 * This module owns the single `openDB` call and the full schema migration history.
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type {
  PersistedAiLibrarySettings,
  PersistedBook,
  PersistedCalendar,
  PersistedCanonicalDoc,
  PersistedCanonicalPatch,
  PersistedChatMessage,
  PersistedChatSession,
  PersistedCharacter,
  PersistedGeneralThread,
  PersistedContinuityIssue,
  PersistedCultureMembership,
  PersistedCultureVersion,
  PersistedChapter,
  PersistedEntry,
  PersistedEntryPatch,
  PersistedEra,
  PersistedEvent,
  PersistedItemOwnership,
  PersistedLocation,
  PersistedMap,
  PersistedMapPin,
  PersistedMedia,
  PersistedMention,
  PersistedMembership,
  PersistedOrganizationVersion,
  PersistedPatchByDocEntry,
  PersistedRAGNode,
  PersistedRelationIndexEntry,
  PersistedReligionVersion,
  PersistedRevision,
  PersistedRelationship,
  PersistedResearchArtifact,
  PersistedResearchRun,
  PersistedScene,
  PersistedSeries,
  PersistedSuggestion,
  PersistedTimeAnchor,
  PersistedTimeline,
  PersistedUniverse,
  PersistedUsageLedger,
  PersistedWorldEntry,
  PersistedStory,
  StoredEmbedding,
  StoredMetadata,
} from "@/lib/rag/store";

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

export interface RAGDBSchema extends DBSchema {
  nodes: {
    key: string;
    value: PersistedRAGNode;
    indexes: { by_parent: string };
  };
  embeddings: {
    key: string;
    value: PersistedEmbedding;
    indexes: {
      by_fragment: string;
      by_hash_model: string;
    };
  };
  metadata: {
    key: string;
    value: StoredMetadata;
  };
  chatSessions: {
    key: string;
    value: PersistedChatSession;
    indexes: { by_updated: number; by_library: string };
  };
  generalThreads: {
    key: string;
    value: PersistedGeneralThread;
    indexes: { by_updated: number; by_context_type: string; by_library: string };
  };
  chatMessages: {
    key: string;
    value: PersistedChatMessage;
    indexes: { by_session: string };
  };
  characters: {
    key: string;
    value: PersistedCharacter;
    indexes: { by_library: string };
  };
  locations: {
    key: string;
    value: PersistedLocation;
    indexes: { by_library: string };
  };
  worldEntries: {
    key: string;
    value: PersistedWorldEntry;
    indexes: { by_library: string };
  };
  stories: {
    key: string;
    value: PersistedStory;
    indexes: { by_library: string };
  };
  aiSettings: {
    key: string;
    value: PersistedAiLibrarySettings;
    indexes: { by_updated: number };
  };
  researchRuns: {
    key: string;
    value: PersistedResearchRun;
    indexes: { by_library: string; by_status: string; by_updated: number };
  };
  researchArtifacts: {
    key: string;
    value: PersistedResearchArtifact;
    indexes: { by_run: string };
  };
  usageLedgers: {
    key: string;
    value: PersistedUsageLedger;
    indexes: { by_updated: number };
  };
  // v7 — canonical document stores
  canonicalDocs: {
    key: string;
    value: PersistedCanonicalDoc;
    indexes: { by_type: string; by_status: string; by_lastVerified: number };
  };
  relationships: {
    key: string;
    value: PersistedRelationship;
    indexes: { by_from: string; by_to: string; by_type: string };
  };
  patches: {
    key: string;
    value: PersistedCanonicalPatch;
    indexes: { by_status: string; by_sourceType: string; by_sourceId: string };
  };
  // v8 — compound-key index stores (replaces buggy single-key v7 stores)
  relationIndexByDoc: {
    key: [string, string]; // [docId, relationshipId]
    value: PersistedRelationIndexEntry;
    indexes: { by_doc: string };
  };
  patchByDoc: {
    key: [string, string]; // [docId, patchId]
    value: PersistedPatchByDocEntry;
    indexes: { by_doc: string; by_status: string; by_patchId: string };
  };
  // v9 — Plan-002 universe engine stores
  universes: {
    key: string;
    value: PersistedUniverse;
    indexes: { by_updated: number };
  };
  entries: {
    key: string;
    value: PersistedEntry;
    indexes: {
      by_universe: string;
      by_entry_type: string;
      by_canon_status: string;
      by_slug: string;
    };
  };
  series: {
    key: string;
    value: PersistedSeries;
    indexes: { by_universe: string; by_order_index: number };
  };
  books: {
    key: string;
    value: PersistedBook;
    indexes: { by_series: string; by_universe: string; by_order_index: number };
  };
  chapters: {
    key: string;
    value: PersistedChapter;
    indexes: { by_book: string; by_number: number };
  };
  scenes: {
    key: string;
    value: PersistedScene;
    indexes: { by_chapter: string; by_number: number; by_time_anchor: string };
  };
  entryRelations: {
    key: string;
    value: PersistedRelationship;
    indexes: { by_from: string; by_to: string; by_type: string };
  };
  timelines: {
    key: string;
    value: PersistedTimeline;
    indexes: { by_universe: string; by_book: string };
  };
  eras: {
    key: string;
    value: PersistedEra;
    indexes: { by_timeline: string };
  };
  events: {
    key: string;
    value: PersistedEvent;
    indexes: { by_universe: string; by_era: string; by_time_anchor: string };
  };
  calendars: {
    key: string;
    value: PersistedCalendar;
    indexes: { by_universe: string };
  };
  timeAnchors: {
    key: string;
    value: PersistedTimeAnchor;
    indexes: { by_calendar: string; by_relative_day: number };
  };
  memberships: {
    key: string;
    value: PersistedMembership;
    indexes: { by_character: string; by_organization: string };
  };
  cultureMemberships: {
    key: string;
    value: PersistedCultureMembership;
    indexes: { by_character: string; by_culture: string };
  };
  itemOwnerships: {
    key: string;
    value: PersistedItemOwnership;
    indexes: { by_item: string; by_owner: string };
  };
  mentions: {
    key: string;
    value: PersistedMention;
    indexes: { by_scene: string; by_entry: string };
  };
  media: {
    key: string;
    value: PersistedMedia;
    indexes: { by_universe: string; by_media_type: string };
  };
  maps: {
    key: string;
    value: PersistedMap;
    indexes: { by_universe: string; by_media: string };
  };
  mapPins: {
    key: string;
    value: PersistedMapPin;
    indexes: { by_map: string; by_entry: string };
  };
  cultureVersions: {
    key: string;
    value: PersistedCultureVersion;
    indexes: { by_culture: string; by_valid_from: string; by_valid_to: string };
  };
  organizationVersions: {
    key: string;
    value: PersistedOrganizationVersion;
    indexes: { by_organization: string; by_valid_from: string; by_valid_to: string };
  };
  religionVersions: {
    key: string;
    value: PersistedReligionVersion;
    indexes: { by_religion: string; by_valid_from: string; by_valid_to: string };
  };
  continuityIssues: {
    key: string;
    value: PersistedContinuityIssue;
    indexes: { by_universe: string; by_severity: string; by_issue_status: string };
  };
  suggestions: {
    key: string;
    value: PersistedSuggestion;
    indexes: { by_universe: string; by_status: string };
  };
  revisions: {
    key: string;
    value: PersistedRevision;
    indexes: { by_target: [string, string]; by_universe: string };
  };
  entryPatches: {
    key: string;
    value: PersistedEntryPatch;
    indexes: { by_status: string; by_sourceType: string; by_sourceId: string };
  };
  entryPatchByEntry: {
    key: [string, string]; // [entryId, patchId]
    value: PersistedPatchByDocEntry;
    indexes: { by_entry: string; by_status: string; by_patchId: string };
  };
}

// ---------------------------------------------------------------------------
// Internal persisted embedding shape (adds lookup keys to StoredEmbedding)
// ---------------------------------------------------------------------------

export interface PersistedEmbedding extends StoredEmbedding {
  key: string; // fragmentId
  hashModel: string; // `${hash}::${model}` for fast lookup
}

// ---------------------------------------------------------------------------
// Database reference type
// ---------------------------------------------------------------------------

export type QuillDB = IDBPDatabase<RAGDBSchema>;

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DB_NAME = "quilliam-rag";
export const DB_VERSION = 12;

/** Human-readable metadata key used to persist library meta in the `metadata` store. */
export function libraryMetaKey(libraryId: string): string {
  return `library-meta:${libraryId}`;
}

// ---------------------------------------------------------------------------
// Singleton DB connection
// ---------------------------------------------------------------------------

let dbPromise: Promise<QuillDB> | null = null;

export function getDb(): Promise<QuillDB> {
  if (!dbPromise) {
    dbPromise = openDB<RAGDBSchema>(DB_NAME, DB_VERSION, {
      async upgrade(database, oldVersion, _newVersion, transaction) {
        // --- v1/v2 stores (always ensure they exist) ---
        if (!database.objectStoreNames.contains("nodes")) {
          const nodes = database.createObjectStore("nodes", { keyPath: "id" });
          nodes.createIndex("by_parent", "parentId");
        }

        if (!database.objectStoreNames.contains("embeddings")) {
          const embeddings = database.createObjectStore("embeddings", { keyPath: "key" });
          embeddings.createIndex("by_fragment", "fragmentId");
          embeddings.createIndex("by_hash_model", "hashModel");
        }

        if (!database.objectStoreNames.contains("metadata")) {
          database.createObjectStore("metadata", { keyPath: "key" });
        }

        if (!database.objectStoreNames.contains("chatSessions")) {
          const sessions = database.createObjectStore("chatSessions", { keyPath: "id" });
          sessions.createIndex("by_updated", "updatedAt");
          sessions.createIndex("by_library", "libraryId");
        } else if (oldVersion < 3) {
          // Upgrading from v2 → add the by_library index to the existing store
          const sessionsStore = transaction.objectStore("chatSessions");
          if (!sessionsStore.indexNames.contains("by_library")) {
            sessionsStore.createIndex("by_library", "libraryId");
          }
        }

        if (!database.objectStoreNames.contains("chatMessages")) {
          const msgs = database.createObjectStore("chatMessages", { keyPath: "key" });
          msgs.createIndex("by_session", "sessionId");
        }

        // --- v3 new stores ---
        if (oldVersion < 3) {
          if (!database.objectStoreNames.contains("characters")) {
            const chars = database.createObjectStore("characters", { keyPath: "id" });
            chars.createIndex("by_library", "libraryId");
          }

          if (!database.objectStoreNames.contains("locations")) {
            const locs = database.createObjectStore("locations", { keyPath: "id" });
            locs.createIndex("by_library", "libraryId");
          }

          if (!database.objectStoreNames.contains("worldEntries")) {
            const world = database.createObjectStore("worldEntries", { keyPath: "id" });
            world.createIndex("by_library", "libraryId");
          }
        }

        // --- v4 new stores ---
        if (oldVersion < 4) {
          if (!database.objectStoreNames.contains("stories")) {
            const stories = database.createObjectStore("stories", { keyPath: "id" });
            stories.createIndex("by_library", "libraryId");
          }
        }

        // --- v5 new stores ---
        if (oldVersion < 5) {
          if (!database.objectStoreNames.contains("aiSettings")) {
            const settings = database.createObjectStore("aiSettings", { keyPath: "libraryId" });
            settings.createIndex("by_updated", "updatedAt");
          }

          if (!database.objectStoreNames.contains("researchRuns")) {
            const runs = database.createObjectStore("researchRuns", { keyPath: "id" });
            runs.createIndex("by_library", "libraryId");
            runs.createIndex("by_status", "status");
            runs.createIndex("by_updated", "updatedAt");
          }

          if (!database.objectStoreNames.contains("researchArtifacts")) {
            const artifacts = database.createObjectStore("researchArtifacts", { keyPath: "id" });
            artifacts.createIndex("by_run", "runId");
          }

          if (!database.objectStoreNames.contains("usageLedgers")) {
            const ledgers = database.createObjectStore("usageLedgers", { keyPath: "runId" });
            ledgers.createIndex("by_updated", "updatedAt");
          }
        }

        // --- v6: clear stale fragments + all embeddings for re-index ---
        // Adaptive semantic chunking (Phase 2) produces different chunk
        // boundaries, so old fragment nodes and their embeddings are invalid.
        // Embeddings are purely derived data; clearing them forces a re-embed
        // with the corrected num_ctx: 8192 setting (also new in this release).
        if (oldVersion < 6) {
          if (database.objectStoreNames.contains("nodes")) {
            const nodeStore = transaction.objectStore("nodes");
            let cursor = await nodeStore.openCursor();
            while (cursor) {
              const node = cursor.value as { type?: string };
              if (node.type === "fragment") await cursor.delete();
              cursor = await cursor.continue();
            }
          }
          if (database.objectStoreNames.contains("embeddings")) {
            await transaction.objectStore("embeddings").clear();
          }
        }

        // --- v7: canonical document stores ---
        if (oldVersion < 7) {
          if (!database.objectStoreNames.contains("canonicalDocs")) {
            const docs = database.createObjectStore("canonicalDocs", { keyPath: "id" });
            docs.createIndex("by_type", "type");
            docs.createIndex("by_status", "status");
            docs.createIndex("by_lastVerified", "lastVerified");
          }

          if (!database.objectStoreNames.contains("relationships")) {
            const rels = database.createObjectStore("relationships", { keyPath: "id" });
            rels.createIndex("by_from", "from");
            rels.createIndex("by_to", "to");
            rels.createIndex("by_type", "type");
          }

          if (!database.objectStoreNames.contains("patches")) {
            const patches = database.createObjectStore("patches", { keyPath: "id" });
            patches.createIndex("by_status", "status");
            patches.createIndex("by_sourceType", "sourceType");
            patches.createIndex("by_sourceId", "sourceId");
          }

          if (!database.objectStoreNames.contains("relationIndexByDoc")) {
            const ridx = database.createObjectStore("relationIndexByDoc", {
              keyPath: ["docId", "relationshipId"],
            });
            ridx.createIndex("by_doc", "docId");
          }

          if (!database.objectStoreNames.contains("patchByDoc")) {
            const pbd = database.createObjectStore("patchByDoc", {
              keyPath: ["docId", "patchId"],
            });
            pbd.createIndex("by_doc", "docId");
            pbd.createIndex("by_status", "status");
            pbd.createIndex("by_patchId", "patchId");
          }

          // Record applied schema version in metadata
          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 7,
              updatedAt: Date.now(),
            });
          }
        }

        // --- v8: replace single-key index stores with compound-key stores ---
        if (oldVersion < 8) {
          // Drop old single-key stores created in v7
          if (database.objectStoreNames.contains("relationIndexByDoc")) {
            database.deleteObjectStore("relationIndexByDoc");
          }
          if (database.objectStoreNames.contains("patchByDoc")) {
            database.deleteObjectStore("patchByDoc");
          }

          // Recreate with compound keyPath
          const ridx = database.createObjectStore("relationIndexByDoc", {
            keyPath: ["docId", "relationshipId"],
          });
          ridx.createIndex("by_doc", "docId");

          const pidx = database.createObjectStore("patchByDoc", {
            keyPath: ["docId", "patchId"],
          });
          pidx.createIndex("by_doc", "docId");
          pidx.createIndex("by_status", "status");
          pidx.createIndex("by_patchId", "patchId");

          // Rebuild patchByDoc index from surviving patches store
          if (database.objectStoreNames.contains("patches")) {
            const patchStore = transaction.objectStore("patches");
            const allPatches = await patchStore.getAll() as PersistedCanonicalPatch[];
            for (const patch of allPatches) {
              const affectedDocs = new Set<string>();
              for (const op of patch.operations) {
                if ("docId" in op) affectedDocs.add(op.docId as string);
                if ("fields" in op && (op.fields as { id?: string }).id) {
                  affectedDocs.add((op.fields as { id: string }).id);
                }
                if ("relationship" in op) {
                  const rel = op.relationship as { from: string; to: string };
                  affectedDocs.add(rel.from);
                  affectedDocs.add(rel.to);
                }
              }
              for (const docId of affectedDocs) {
                await pidx.put({ docId, patchId: patch.id, status: patch.status });
              }
            }
          }

          // Rebuild relationIndexByDoc index from surviving relationships store
          if (database.objectStoreNames.contains("relationships")) {
            const relStore = transaction.objectStore("relationships");
            const allRels = await relStore.getAll() as PersistedRelationship[];
            for (const rel of allRels) {
              await ridx.put({ docId: rel.from, relationshipId: rel.id });
              await ridx.put({ docId: rel.to,   relationshipId: rel.id });
            }
          }

          // Update schemaVersion marker
          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 8,
              updatedAt: Date.now(),
            });
          }
        }

        // --- v9: Plan-002 universe engine stores ---
        if (oldVersion < 9) {
          if (!database.objectStoreNames.contains("universes")) {
            const universes = database.createObjectStore("universes", { keyPath: "id" });
            universes.createIndex("by_updated", "updatedAt");
          }

          if (!database.objectStoreNames.contains("entries")) {
            const entries = database.createObjectStore("entries", { keyPath: "id" });
            entries.createIndex("by_universe", "universeId");
            entries.createIndex("by_entry_type", "entryType");
            entries.createIndex("by_canon_status", "canonStatus");
            entries.createIndex("by_slug", "slug");
          }

          if (!database.objectStoreNames.contains("entryRelations")) {
            const rels = database.createObjectStore("entryRelations", { keyPath: "id" });
            rels.createIndex("by_from", "from");
            rels.createIndex("by_to", "to");
            rels.createIndex("by_type", "type");
          }

          if (!database.objectStoreNames.contains("timelines")) {
            const timelines = database.createObjectStore("timelines", { keyPath: "id" });
            timelines.createIndex("by_universe", "universeId");
            timelines.createIndex("by_book", "bookId");
          }

          if (!database.objectStoreNames.contains("eras")) {
            const eras = database.createObjectStore("eras", { keyPath: "id" });
            eras.createIndex("by_timeline", "timelineId");
          }

          if (!database.objectStoreNames.contains("events")) {
            const events = database.createObjectStore("events", { keyPath: "id" });
            events.createIndex("by_universe", "universeId");
            events.createIndex("by_era", "eraId");
            events.createIndex("by_time_anchor", "timeAnchorId");
          }

          if (!database.objectStoreNames.contains("calendars")) {
            const calendars = database.createObjectStore("calendars", { keyPath: "id" });
            calendars.createIndex("by_universe", "universeId");
          }

          if (!database.objectStoreNames.contains("timeAnchors")) {
            const anchors = database.createObjectStore("timeAnchors", { keyPath: "id" });
            anchors.createIndex("by_calendar", "calendarId");
            anchors.createIndex("by_relative_day", "relativeDay");
          }

          if (!database.objectStoreNames.contains("mentions")) {
            const mentions = database.createObjectStore("mentions", { keyPath: "id" });
            mentions.createIndex("by_scene", "sceneId");
            mentions.createIndex("by_entry", "entryId");
          }

          if (!database.objectStoreNames.contains("cultureVersions")) {
            const versions = database.createObjectStore("cultureVersions", { keyPath: "id" });
            versions.createIndex("by_culture", "cultureEntryId");
            versions.createIndex("by_valid_from", "validFromEventId");
            versions.createIndex("by_valid_to", "validToEventId");
          }

          if (!database.objectStoreNames.contains("continuityIssues")) {
            const issues = database.createObjectStore("continuityIssues", { keyPath: "id" });
            issues.createIndex("by_universe", "universeId");
            issues.createIndex("by_severity", "severity");
            issues.createIndex("by_issue_status", "status");
          }

          if (!database.objectStoreNames.contains("suggestions")) {
            const suggestions = database.createObjectStore("suggestions", { keyPath: "id" });
            suggestions.createIndex("by_universe", "universeId");
            suggestions.createIndex("by_status", "status");
          }

          if (!database.objectStoreNames.contains("revisions")) {
            const revisions = database.createObjectStore("revisions", { keyPath: "id" });
            revisions.createIndex("by_target", ["targetType", "targetId"]);
            revisions.createIndex("by_universe", "universeId");
          }

          if (!database.objectStoreNames.contains("entryPatches")) {
            const patches = database.createObjectStore("entryPatches", { keyPath: "id" });
            patches.createIndex("by_status", "status");
            patches.createIndex("by_sourceType", "sourceRef.kind");
            patches.createIndex("by_sourceId", "sourceRef.id");
          }

          if (!database.objectStoreNames.contains("entryPatchByEntry")) {
            const idx = database.createObjectStore("entryPatchByEntry", {
              keyPath: ["docId", "patchId"],
            });
            idx.createIndex("by_entry", "docId");
            idx.createIndex("by_status", "status");
            idx.createIndex("by_patchId", "patchId");
          }

          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 9,
              updatedAt: Date.now(),
            });
          }
        }

        // --- v10: Plan-002 schema parity (manuscript + join + map/media stores) ---
        if (oldVersion < 10) {
          if (!database.objectStoreNames.contains("series")) {
            const series = database.createObjectStore("series", { keyPath: "id" });
            series.createIndex("by_universe", "universeId");
            series.createIndex("by_order_index", "orderIndex");
          }

          if (!database.objectStoreNames.contains("books")) {
            const books = database.createObjectStore("books", { keyPath: "id" });
            books.createIndex("by_series", "seriesId");
            books.createIndex("by_universe", "universeId");
            books.createIndex("by_order_index", "orderIndex");
          }

          if (!database.objectStoreNames.contains("chapters")) {
            const chapters = database.createObjectStore("chapters", { keyPath: "id" });
            chapters.createIndex("by_book", "bookId");
            chapters.createIndex("by_number", "number");
          }

          if (!database.objectStoreNames.contains("scenes")) {
            const scenes = database.createObjectStore("scenes", { keyPath: "id" });
            scenes.createIndex("by_chapter", "chapterId");
            scenes.createIndex("by_number", "number");
            scenes.createIndex("by_time_anchor", "timeAnchorId");
          }

          if (!database.objectStoreNames.contains("memberships")) {
            const memberships = database.createObjectStore("memberships", { keyPath: "id" });
            memberships.createIndex("by_character", "characterEntryId");
            memberships.createIndex("by_organization", "organizationEntryId");
          }

          if (!database.objectStoreNames.contains("cultureMemberships")) {
            const cultureMemberships = database.createObjectStore("cultureMemberships", { keyPath: "id" });
            cultureMemberships.createIndex("by_character", "characterEntryId");
            cultureMemberships.createIndex("by_culture", "cultureEntryId");
          }

          if (!database.objectStoreNames.contains("itemOwnerships")) {
            const itemOwnerships = database.createObjectStore("itemOwnerships", { keyPath: "id" });
            itemOwnerships.createIndex("by_item", "itemEntryId");
            itemOwnerships.createIndex("by_owner", "ownerEntryId");
          }

          if (!database.objectStoreNames.contains("media")) {
            const media = database.createObjectStore("media", { keyPath: "id" });
            media.createIndex("by_universe", "universeId");
            media.createIndex("by_media_type", "mediaType");
          }

          if (!database.objectStoreNames.contains("maps")) {
            const maps = database.createObjectStore("maps", { keyPath: "id" });
            maps.createIndex("by_universe", "universeId");
            maps.createIndex("by_media", "mediaId");
          }

          if (!database.objectStoreNames.contains("mapPins")) {
            const mapPins = database.createObjectStore("mapPins", { keyPath: "id" });
            mapPins.createIndex("by_map", "mapId");
            mapPins.createIndex("by_entry", "entryId");
          }

          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 10,
              updatedAt: Date.now(),
            });
          }
        }

        // --- v11: temporal version stores for era-aware entity evolution ---
        if (oldVersion < 11) {
          if (!database.objectStoreNames.contains("organizationVersions")) {
            const versions = database.createObjectStore("organizationVersions", { keyPath: "id" });
            versions.createIndex("by_organization", "organizationEntryId");
            versions.createIndex("by_valid_from", "validFromEventId");
            versions.createIndex("by_valid_to", "validToEventId");
          }

          if (!database.objectStoreNames.contains("religionVersions")) {
            const versions = database.createObjectStore("religionVersions", { keyPath: "id" });
            versions.createIndex("by_religion", "religionEntryId");
            versions.createIndex("by_valid_from", "validFromEventId");
            versions.createIndex("by_valid_to", "validToEventId");
          }

          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 11,
              updatedAt: Date.now(),
            });
          }
        }

        // --- v12: general (landing-page) threads store ---
        if (oldVersion < 12) {
          if (!database.objectStoreNames.contains("generalThreads")) {
            const threads = database.createObjectStore("generalThreads", { keyPath: "id" });
            threads.createIndex("by_updated", "updatedAt");
            threads.createIndex("by_context_type", "contextType");
            threads.createIndex("by_library", "libraryId");
          }

          if (database.objectStoreNames.contains("metadata")) {
            await transaction.objectStore("metadata").put({
              key: "schemaVersion",
              value: 12,
              updatedAt: Date.now(),
            });
          }
        }
      },
    });
  }
  return dbPromise;
}
