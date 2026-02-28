/**
 * IndexedDB persistence for RAG nodes and embeddings.
 * All manuscript data stays local to the browser (zero-knowledge).
 */

import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { RAGNode } from "@/lib/rag/hierarchy";
import {
  materializeEmbedding,
  materializeNode,
  serializeNode,
  type PersistedAiLibrarySettings,
  type PersistedBook,
  type PersistedCalendar,
  type PersistedCanonicalDoc,
  type PersistedCanonicalPatch,
  type PersistedChatMessage,
  type PersistedChatSession,
  type PersistedCharacter,
  type PersistedContinuityIssue,
  type PersistedCultureMembership,
  type PersistedCultureVersion,
  type PersistedChapter,
  type PersistedEntry,
  type PersistedEntryPatch,
  type PersistedEra,
  type PersistedEvent,
  type PersistedItemOwnership,
  type PersistedLibraryMeta,
  type PersistedLocation,
  type PersistedMap,
  type PersistedMapPin,
  type PersistedMedia,
  type PersistedMention,
  type PersistedMembership,
  type PersistedOrganizationVersion,
  type PersistedPatchByDocEntry,
  type PersistedRelationIndexEntry,
  type PersistedReligionVersion,
  type PersistedRevision,
  type PersistedRelationship,
  type PersistedResearchArtifact,
  type PersistedResearchRun,
  type PersistedScene,
  type PersistedSeries,
  type PersistedSuggestion,
  type PersistedTimeAnchor,
  type PersistedTimeline,
  type PersistedUniverse,
  type PersistedUsageLedger,
  type PersistedWorldEntry,
  type PersistedStory,
  type PersistedRAGNode,
  type RAGStore,
  type StoredEmbedding,
  type StoredMetadata,
} from "@/lib/rag/store";
import type { CanonicalType, EntryType } from "@/lib/types";

interface RAGDBSchema extends DBSchema {
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

interface PersistedEmbedding extends StoredEmbedding {
  key: string; // fragmentId
  hashModel: string; // `${hash}::${model}` for fast lookup
}

function libraryMetaKey(libraryId: string): string {
  return `library-meta:${libraryId}`;
}

const DB_NAME = "quilliam-rag";
const DB_VERSION = 11;

let dbPromise: Promise<IDBPDatabase<RAGDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<RAGDBSchema>> {
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
      },
    });
  }
  return dbPromise;
}

function toPersistedEmbedding(record: StoredEmbedding): PersistedEmbedding {
  return {
    ...record,
    key: record.fragmentId,
    hashModel: `${record.hash}::${record.model}`,
  };
}

async function collectCascadeNodeIds(db: IDBPDatabase<RAGDBSchema>, rootId: string): Promise<string[]> {
  const allNodes = (await db.getAll("nodes")).map(materializeNode);
  const childrenByParent = new Map<string, string[]>();

  for (const node of allNodes) {
    if (!node.parentId) continue;
    const list = childrenByParent.get(node.parentId) ?? [];
    list.push(node.id);
    childrenByParent.set(node.parentId, list);
  }

  const queue: string[] = [rootId];
  const ids: string[] = [];
  const seen = new Set<string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    ids.push(current);
    const children = childrenByParent.get(current);
    if (children) queue.push(...children);
  }

  return ids;
}

async function deleteEmbeddingForFragment(
  tx: ReturnType<IDBPDatabase<RAGDBSchema>["transaction"]>,
  fragmentId: string,
): Promise<void> {
  const embeddingIndex = tx.objectStore("embeddings").index("by_fragment");
  let cursor = await embeddingIndex.openCursor(fragmentId);
  while (cursor) {
    if (cursor.delete) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
}

export async function putNode(node: RAGNode): Promise<void> {
  const db = await getDb();
  await db.put("nodes", serializeNode(node));
}

export async function getNode(id: string): Promise<RAGNode | null> {
  const db = await getDb();
  const record = await db.get("nodes", id);
  return record ? materializeNode(record) : null;
}

export async function deleteNode(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["nodes", "embeddings"], "readwrite");
  await tx.objectStore("nodes").delete(id);
  await deleteEmbeddingForFragment(tx, id);

  await tx.done;
}

export async function listChildren(parentId: string | null): Promise<RAGNode[]> {
  const db = await getDb();
  const records = await db.getAllFromIndex("nodes", "by_parent", parentId);
  return records.map(materializeNode);
}

export async function listAllNodes(): Promise<RAGNode[]> {
  const db = await getDb();
  const records = await db.getAll("nodes");
  return records.map(materializeNode);
}

export async function putEmbedding(record: StoredEmbedding): Promise<void> {
  const db = await getDb();
  await db.put("embeddings", toPersistedEmbedding(record));
}

export async function getEmbeddingByFragment(fragmentId: string): Promise<StoredEmbedding | null> {
  const db = await getDb();
  const index = db.transaction("embeddings", "readonly").store.index("by_fragment");
  const match = await index.get(fragmentId);
  return match ? materializeEmbedding(match) : null;
}

export async function getEmbeddingByHash(hash: string, model: string): Promise<StoredEmbedding | null> {
  const db = await getDb();
  const index = db.transaction("embeddings", "readonly").store.index("by_hash_model");
  const match = await index.get(`${hash}::${model}`);
  return match ? materializeEmbedding(match) : null;
}

export async function setMetadata(entry: StoredMetadata): Promise<void> {
  const db = await getDb();
  await db.put("metadata", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function getMetadata<T = unknown>(key: string): Promise<T | null> {
  const db = await getDb();
  const record = await db.get("metadata", key);
  return record ? (record.value as T) : null;
}

/* ==============================================================
   Chat persistence
   ============================================================== */

export async function putChatSession(session: PersistedChatSession): Promise<void> {
  const db = await getDb();
  await db.put("chatSessions", session);
}

export async function listChatSessions(): Promise<PersistedChatSession[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("chatSessions", "by_updated");
  return all.reverse(); // most-recently updated first
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["chatSessions", "chatMessages"], "readwrite");
  await tx.objectStore("chatSessions").delete(id);
  const index = tx.objectStore("chatMessages").index("by_session");
  let cursor = await index.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function putChatMessages(
  sessionId: string,
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction("chatMessages", "readwrite");
  // clear existing msgs for this session
  const index = tx.store.index("by_session");
  let cursor = await index.openCursor(sessionId);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }
  // write fresh
  for (let i = 0; i < messages.length; i++) {
    const msg: PersistedChatMessage = {
      key: `${sessionId}::${i}`,
      sessionId,
      index: i,
      role: messages[i].role,
      content: messages[i].content,
      createdAt: Date.now(),
    };
    await tx.store.put(msg);
  }
  await tx.done;
}

export async function listChatMessages(sessionId: string): Promise<PersistedChatMessage[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("chatMessages", "by_session", sessionId);
  return all.sort((a, b) => a.index - b.index);
}

export async function listChatSessionsByLibrary(libraryId: string): Promise<PersistedChatSession[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("chatSessions", "by_library", libraryId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

/* ==============================================================
   Character / Location / WorldEntry persistence
   ============================================================== */

export async function putCharacter(entry: PersistedCharacter): Promise<void> {
  const db = await getDb();
  await db.put("characters", entry);
}

export async function getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]> {
  const db = await getDb();
  return db.getAllFromIndex("characters", "by_library", libraryId);
}

export async function deleteCharacter(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("characters", id);
}

export async function putLocation(entry: PersistedLocation): Promise<void> {
  const db = await getDb();
  await db.put("locations", entry);
}

export async function getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]> {
  const db = await getDb();
  return db.getAllFromIndex("locations", "by_library", libraryId);
}

export async function deleteLocation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("locations", id);
}

export async function putWorldEntry(entry: PersistedWorldEntry): Promise<void> {
  const db = await getDb();
  await db.put("worldEntries", entry);
}

export async function getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex("worldEntries", "by_library", libraryId);
}

export async function deleteWorldEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("worldEntries", id);
}

/* ==============================================================
   Story persistence
   ============================================================== */

export async function putStory(entry: PersistedStory): Promise<void> {
  const db = await getDb();
  await db.put("stories", entry);
}

export async function getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("stories", "by_library", libraryId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function getStory(id: string): Promise<PersistedStory | null> {
  const db = await getDb();
  const record = await db.get("stories", id);
  return record ?? null;
}

export async function deleteStory(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("stories", id);
}

export async function deleteStoryCascade(id: string): Promise<void> {
  const db = await getDb();
  const nodeIds = await collectCascadeNodeIds(db, id);
  const tx = db.transaction(["stories", "nodes", "embeddings"], "readwrite");

  await tx.objectStore("stories").delete(id);
  for (const nodeId of nodeIds) {
    await tx.objectStore("nodes").delete(nodeId);
    await deleteEmbeddingForFragment(tx, nodeId);
  }

  await tx.done;
}

export async function deleteLibraryCascade(libraryId: string): Promise<void> {
  const db = await getDb();
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

export async function putLibraryMeta(entry: PersistedLibraryMeta): Promise<void> {
  await setMetadata({
    key: libraryMetaKey(entry.libraryId),
    value: entry,
    updatedAt: entry.updatedAt,
  });
}

export async function getLibraryMeta(libraryId: string): Promise<PersistedLibraryMeta | null> {
  return getMetadata<PersistedLibraryMeta>(libraryMetaKey(libraryId));
}

export async function deleteLibraryMeta(libraryId: string): Promise<void> {
  const db = await getDb();
  await db.delete("metadata", libraryMetaKey(libraryId));
}

/* ==============================================================
   AI settings / research persistence
   ============================================================== */

export async function putAiLibrarySettings(entry: PersistedAiLibrarySettings): Promise<void> {
  const db = await getDb();
  await db.put("aiSettings", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function getAiLibrarySettings(libraryId: string): Promise<PersistedAiLibrarySettings | null> {
  const db = await getDb();
  const record = await db.get("aiSettings", libraryId);
  return record ?? null;
}

export async function deleteAiLibrarySettings(libraryId: string): Promise<void> {
  const db = await getDb();
  await db.delete("aiSettings", libraryId);
}

export async function putResearchRun(entry: PersistedResearchRun): Promise<void> {
  const db = await getDb();
  await db.put("researchRuns", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function getResearchRun(id: string): Promise<PersistedResearchRun | null> {
  const db = await getDb();
  const record = await db.get("researchRuns", id);
  return record ?? null;
}

export async function listResearchRunsByLibrary(libraryId: string): Promise<PersistedResearchRun[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("researchRuns", "by_library", libraryId);
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function putResearchArtifact(entry: PersistedResearchArtifact): Promise<void> {
  const db = await getDb();
  await db.put("researchArtifacts", entry);
}

export async function listResearchArtifacts(runId: string): Promise<PersistedResearchArtifact[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("researchArtifacts", "by_run", runId);
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putUsageLedger(entry: PersistedUsageLedger): Promise<void> {
  const db = await getDb();
  await db.put("usageLedgers", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function getUsageLedger(runId: string): Promise<PersistedUsageLedger | null> {
  const db = await getDb();
  const record = await db.get("usageLedgers", runId);
  return record ?? null;
}

/* ==============================================================
   Plan-002 universe engine stores
   ============================================================== */

export async function putUniverse(universe: PersistedUniverse): Promise<void> {
  const db = await getDb();
  await db.put("universes", { ...universe, updatedAt: universe.updatedAt ?? Date.now() });
}

export async function getUniverse(id: string): Promise<PersistedUniverse | null> {
  const db = await getDb();
  const record = await db.get("universes", id);
  return record ?? null;
}

export async function listUniverses(): Promise<PersistedUniverse[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("universes", "by_updated");
  return all.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function addEntry(entry: PersistedEntry): Promise<void> {
  const db = await getDb();
  await db.put("entries", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function updateEntry(id: string, patch: Partial<PersistedEntry>): Promise<void> {
  const db = await getDb();
  const existing = await db.get("entries", id);
  if (!existing) return;
  await db.put("entries", { ...existing, ...patch, id, updatedAt: Date.now() });
}

export async function getEntryById(id: string): Promise<PersistedEntry | undefined> {
  const db = await getDb();
  return db.get("entries", id);
}

export async function listEntriesByUniverse(universeId: string): Promise<PersistedEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex("entries", "by_universe", universeId);
}

export async function queryEntriesByType(type: EntryType): Promise<PersistedEntry[]> {
  const db = await getDb();
  return db.getAllFromIndex("entries", "by_entry_type", type);
}

export async function deleteEntry(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("entries", id);
}

export async function putSeries(entry: PersistedSeries): Promise<void> {
  const db = await getDb();
  await db.put("series", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function listSeriesByUniverse(universeId: string): Promise<PersistedSeries[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("series", "by_universe", universeId);
  return all.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function putBook(entry: PersistedBook): Promise<void> {
  const db = await getDb();
  await db.put("books", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function listBooksBySeries(seriesId: string): Promise<PersistedBook[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("books", "by_series", seriesId);
  return all.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function listBooksByUniverse(universeId: string): Promise<PersistedBook[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("books", "by_universe", universeId);
  return all.sort((a, b) => a.orderIndex - b.orderIndex);
}

export async function putChapter(entry: PersistedChapter): Promise<void> {
  const db = await getDb();
  await db.put("chapters", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function listChaptersByBook(bookId: string): Promise<PersistedChapter[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("chapters", "by_book", bookId);
  return all.sort((a, b) => a.number - b.number);
}

export async function putScene(entry: PersistedScene): Promise<void> {
  const db = await getDb();
  await db.put("scenes", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
}

export async function listScenesByChapter(chapterId: string): Promise<PersistedScene[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex("scenes", "by_chapter", chapterId);
  return all.sort((a, b) => a.number - b.number);
}

export async function getSceneById(id: string): Promise<PersistedScene | undefined> {
  const db = await getDb();
  return db.get("scenes", id);
}

export async function addEntryRelation(rel: PersistedRelationship): Promise<void> {
  const db = await getDb();
  await db.put("entryRelations", rel);
}

export async function removeEntryRelation(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("entryRelations", id);
}

export async function getEntryRelationsForEntry(entryId: string): Promise<PersistedRelationship[]> {
  const db = await getDb();
  const [from, to] = await Promise.all([
    db.getAllFromIndex("entryRelations", "by_from", entryId),
    db.getAllFromIndex("entryRelations", "by_to", entryId),
  ]);
  const byId = new Map<string, PersistedRelationship>();
  [...from, ...to].forEach((rel) => byId.set(rel.id, rel));
  return [...byId.values()];
}

export async function putTimeline(entry: PersistedTimeline): Promise<void> {
  const db = await getDb();
  await db.put("timelines", entry);
}

export async function listTimelinesByUniverse(universeId: string): Promise<PersistedTimeline[]> {
  const db = await getDb();
  return db.getAllFromIndex("timelines", "by_universe", universeId);
}

export async function listTimelinesByBook(bookId: string): Promise<PersistedTimeline[]> {
  const db = await getDb();
  return db.getAllFromIndex("timelines", "by_book", bookId);
}

export async function putEra(entry: PersistedEra): Promise<void> {
  const db = await getDb();
  await db.put("eras", entry);
}

export async function listErasByTimeline(timelineId: string): Promise<PersistedEra[]> {
  const db = await getDb();
  return db.getAllFromIndex("eras", "by_timeline", timelineId);
}

export async function putEvent(entry: PersistedEvent): Promise<void> {
  const db = await getDb();
  await db.put("events", entry);
}

export async function listEventsByUniverse(universeId: string): Promise<PersistedEvent[]> {
  const db = await getDb();
  return db.getAllFromIndex("events", "by_universe", universeId);
}

export async function listEventsByEra(eraId: string): Promise<PersistedEvent[]> {
  const db = await getDb();
  return db.getAllFromIndex("events", "by_era", eraId);
}

export async function putCalendar(entry: PersistedCalendar): Promise<void> {
  const db = await getDb();
  await db.put("calendars", entry);
}

export async function listCalendarsByUniverse(universeId: string): Promise<PersistedCalendar[]> {
  const db = await getDb();
  return db.getAllFromIndex("calendars", "by_universe", universeId);
}

export async function putTimeAnchor(entry: PersistedTimeAnchor): Promise<void> {
  const db = await getDb();
  await db.put("timeAnchors", entry);
}

export async function getTimeAnchor(id: string): Promise<PersistedTimeAnchor | null> {
  const db = await getDb();
  const record = await db.get("timeAnchors", id);
  return record ?? null;
}

export async function listTimeAnchorsByCalendar(calendarId: string): Promise<PersistedTimeAnchor[]> {
  const db = await getDb();
  return db.getAllFromIndex("timeAnchors", "by_calendar", calendarId);
}

export async function putMembership(entry: PersistedMembership): Promise<void> {
  const db = await getDb();
  await db.put("memberships", entry);
}

export async function listMembershipsByCharacter(characterEntryId: string): Promise<PersistedMembership[]> {
  const db = await getDb();
  return db.getAllFromIndex("memberships", "by_character", characterEntryId);
}

export async function listMembershipsByOrganization(organizationEntryId: string): Promise<PersistedMembership[]> {
  const db = await getDb();
  return db.getAllFromIndex("memberships", "by_organization", organizationEntryId);
}

export async function putCultureMembership(entry: PersistedCultureMembership): Promise<void> {
  const db = await getDb();
  await db.put("cultureMemberships", entry);
}

export async function listCultureMembershipsByCharacter(
  characterEntryId: string
): Promise<PersistedCultureMembership[]> {
  const db = await getDb();
  return db.getAllFromIndex("cultureMemberships", "by_character", characterEntryId);
}

export async function listCultureMembershipsByCulture(cultureEntryId: string): Promise<PersistedCultureMembership[]> {
  const db = await getDb();
  return db.getAllFromIndex("cultureMemberships", "by_culture", cultureEntryId);
}

export async function putItemOwnership(entry: PersistedItemOwnership): Promise<void> {
  const db = await getDb();
  await db.put("itemOwnerships", entry);
}

export async function listItemOwnershipByItem(itemEntryId: string): Promise<PersistedItemOwnership[]> {
  const db = await getDb();
  return db.getAllFromIndex("itemOwnerships", "by_item", itemEntryId);
}

export async function listItemOwnershipByOwner(ownerEntryId: string): Promise<PersistedItemOwnership[]> {
  const db = await getDb();
  return db.getAllFromIndex("itemOwnerships", "by_owner", ownerEntryId);
}

export async function putMention(entry: PersistedMention): Promise<void> {
  const db = await getDb();
  await db.put("mentions", entry);
}

export async function listMentionsByScene(sceneId: string): Promise<PersistedMention[]> {
  const db = await getDb();
  return db.getAllFromIndex("mentions", "by_scene", sceneId);
}

export async function listMentionsByEntry(entryId: string): Promise<PersistedMention[]> {
  const db = await getDb();
  return db.getAllFromIndex("mentions", "by_entry", entryId);
}

export async function putMedia(entry: PersistedMedia): Promise<void> {
  const db = await getDb();
  await db.put("media", entry);
}

export async function listMediaByUniverse(universeId: string): Promise<PersistedMedia[]> {
  const db = await getDb();
  return db.getAllFromIndex("media", "by_universe", universeId);
}

export async function putMap(entry: PersistedMap): Promise<void> {
  const db = await getDb();
  await db.put("maps", entry);
}

export async function listMapsByUniverse(universeId: string): Promise<PersistedMap[]> {
  const db = await getDb();
  return db.getAllFromIndex("maps", "by_universe", universeId);
}

export async function putMapPin(entry: PersistedMapPin): Promise<void> {
  const db = await getDb();
  await db.put("mapPins", entry);
}

export async function listMapPinsByMap(mapId: string): Promise<PersistedMapPin[]> {
  const db = await getDb();
  return db.getAllFromIndex("mapPins", "by_map", mapId);
}

export async function listMapPinsByEntry(entryId: string): Promise<PersistedMapPin[]> {
  const db = await getDb();
  return db.getAllFromIndex("mapPins", "by_entry", entryId);
}

export async function addCultureVersion(entry: PersistedCultureVersion): Promise<void> {
  const db = await getDb();
  await db.put("cultureVersions", entry);
}

export async function listCultureVersionsByCulture(cultureEntryId: string): Promise<PersistedCultureVersion[]> {
  const db = await getDb();
  return db.getAllFromIndex("cultureVersions", "by_culture", cultureEntryId);
}

export async function addOrganizationVersion(entry: PersistedOrganizationVersion): Promise<void> {
  const db = await getDb();
  await db.put("organizationVersions", entry);
}

export async function listOrganizationVersionsByOrganization(
  organizationEntryId: string
): Promise<PersistedOrganizationVersion[]> {
  const db = await getDb();
  return db.getAllFromIndex("organizationVersions", "by_organization", organizationEntryId);
}

export async function addReligionVersion(entry: PersistedReligionVersion): Promise<void> {
  const db = await getDb();
  await db.put("religionVersions", entry);
}

export async function listReligionVersionsByReligion(religionEntryId: string): Promise<PersistedReligionVersion[]> {
  const db = await getDb();
  return db.getAllFromIndex("religionVersions", "by_religion", religionEntryId);
}

export async function addContinuityIssue(entry: PersistedContinuityIssue): Promise<void> {
  const db = await getDb();
  await db.put("continuityIssues", entry);
}

export async function listContinuityIssuesByUniverse(universeId: string): Promise<PersistedContinuityIssue[]> {
  const db = await getDb();
  return db.getAllFromIndex("continuityIssues", "by_universe", universeId);
}

export async function updateContinuityIssueStatus(
  id: string,
  status: PersistedContinuityIssue["status"],
  resolution?: string,
): Promise<void> {
  const db = await getDb();
  const existing = await db.get("continuityIssues", id);
  if (!existing) return;
  await db.put("continuityIssues", {
    ...existing,
    status,
    resolution: resolution ?? existing.resolution,
    updatedAt: Date.now(),
  });
}

export async function addSuggestion(entry: PersistedSuggestion): Promise<void> {
  const db = await getDb();
  await db.put("suggestions", entry);
}

export async function listSuggestionsByUniverse(universeId: string): Promise<PersistedSuggestion[]> {
  const db = await getDb();
  return db.getAllFromIndex("suggestions", "by_universe", universeId);
}

export async function updateSuggestionStatus(id: string, status: PersistedSuggestion["status"]): Promise<void> {
  const db = await getDb();
  const existing = await db.get("suggestions", id);
  if (!existing) return;
  await db.put("suggestions", { ...existing, status, updatedAt: Date.now() });
}

export async function addRevision(entry: PersistedRevision): Promise<void> {
  const db = await getDb();
  await db.put("revisions", entry);
}

export async function listRevisionsForTarget(targetType: string, targetId: string): Promise<PersistedRevision[]> {
  const db = await getDb();
  return db.getAllFromIndex("revisions", "by_target", [targetType, targetId]);
}

export async function addEntryPatch(patch: PersistedEntryPatch): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["entryPatches", "entryPatchByEntry"], "readwrite");
  await tx.objectStore("entryPatches").put(patch);
  const entryIds = new Set<string>();
  for (const op of patch.operations) {
    if ("entryId" in op) entryIds.add(op.entryId as string);
    if ("docId" in op) entryIds.add(op.docId as string);
    if ("entry" in op && op.entry?.id) entryIds.add(op.entry.id as string);
    if ("fields" in op && op.fields?.id) entryIds.add(op.fields.id as string);
    if ("relation" in op) {
      entryIds.add(op.relation.from);
      entryIds.add(op.relation.to);
    }
    if ("relationship" in op) {
      entryIds.add(op.relationship.from);
      entryIds.add(op.relationship.to);
    }
  }
  for (const entryId of entryIds) {
    await tx.objectStore("entryPatchByEntry").put({
      docId: entryId,
      patchId: patch.id,
      status: patch.status,
    });
  }
  await tx.done;
}

export async function getPendingEntryPatches(): Promise<PersistedEntryPatch[]> {
  const db = await getDb();
  return db.getAllFromIndex("entryPatches", "by_status", "pending");
}

export async function listAllEntryPatches(): Promise<PersistedEntryPatch[]> {
  const db = await getDb();
  return db.getAll("entryPatches");
}

export async function getEntryPatchesForEntry(entryId: string): Promise<PersistedEntryPatch[]> {
  const db = await getDb();
  const entries = await db.getAllFromIndex("entryPatchByEntry", "by_entry", entryId);
  if (entries.length === 0) return [];
  const tx = db.transaction("entryPatches", "readonly");
  const rows = await Promise.all(entries.map((entry) => tx.store.get(entry.patchId)));
  return rows.filter((row): row is PersistedEntryPatch => row !== undefined);
}

/* ==============================================================
   Canonical documents (Plan 001 — Phase 3)
   ============================================================== */

export async function addDoc(doc: PersistedCanonicalDoc): Promise<void> {
  const db = await getDb();
  const normalized = { ...doc, updatedAt: doc.updatedAt ?? Date.now() };
  await db.put("canonicalDocs", normalized);
  // Bridge write to the Plan-002 entries store.
  await db.put("entries", normalized);
}

export async function updateDoc(id: string, patch: Partial<PersistedCanonicalDoc>): Promise<void> {
  const db = await getDb();
  const existing = await db.get("canonicalDocs", id);
  if (!existing) return;
  const next = { ...existing, ...patch, id, updatedAt: Date.now() };
  await db.put("canonicalDocs", next);
  await db.put("entries", next);
}

export async function getDocById(id: string): Promise<PersistedCanonicalDoc | undefined> {
  const db = await getDb();
  const entry = await db.get("entries", id);
  if (entry) return entry;
  return db.get("canonicalDocs", id);
}

export async function queryDocsByType(type: CanonicalType): Promise<PersistedCanonicalDoc[]> {
  const db = await getDb();
  const entries = await db.getAllFromIndex("entries", "by_entry_type", type);
  if (entries.length > 0) return entries;
  return db.getAllFromIndex("canonicalDocs", "by_type", type);
}

export async function deleteDoc(id: string): Promise<void> {
  const db = await getDb();
  await db.delete("canonicalDocs", id);
  await db.delete("entries", id);
}

/* ==============================================================
   Relationships (Plan 001 — Phase 3)
   ============================================================== */

export async function addRelationship(rel: PersistedRelationship): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["relationships", "relationIndexByDoc", "entryRelations"], "readwrite");
  await tx.objectStore("relationships").put(rel);
  await tx.objectStore("entryRelations").put(rel);
  // Upsert both directions in the denormalised index
  await tx.objectStore("relationIndexByDoc").put({ docId: rel.from, relationshipId: rel.id });
  await tx.objectStore("relationIndexByDoc").put({ docId: rel.to,   relationshipId: rel.id });
  await tx.done;
}

export async function removeRelationship(id: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["relationships", "relationIndexByDoc", "entryRelations"], "readwrite");
  const rel = await tx.objectStore("relationships").get(id);
  if (rel) {
    await tx.objectStore("relationships").delete(id);
    await tx.objectStore("entryRelations").delete(id);
    // Compound key: [docId, relationshipId]
    await tx.objectStore("relationIndexByDoc").delete([rel.from, id]);
    await tx.objectStore("relationIndexByDoc").delete([rel.to,   id]);
  }
  await tx.done;
}

export async function getRelationsForDoc(docId: string): Promise<PersistedRelationship[]> {
  const db = await getDb();
  const [entryFrom, entryTo] = await Promise.all([
    db.getAllFromIndex("entryRelations", "by_from", docId),
    db.getAllFromIndex("entryRelations", "by_to", docId),
  ]);
  if (entryFrom.length + entryTo.length > 0) {
    const map = new Map<string, PersistedRelationship>();
    [...entryFrom, ...entryTo].forEach((row) => map.set(row.id, row));
    return [...map.values()];
  }
  // Range scan via compound-key index: all rows where docId matches
  const entries = await db.getAllFromIndex("relationIndexByDoc", "by_doc", docId);
  if (entries.length === 0) return [];
  const tx = db.transaction("relationships", "readonly");
  const results = await Promise.all(entries.map((e) => tx.store.get(e.relationshipId)));
  return results.filter((r): r is PersistedRelationship => r !== undefined);
}

/* ==============================================================
   Patches (Plan 001 — Phase 3)
   ============================================================== */

export async function addPatch(patch: PersistedCanonicalPatch): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["patches", "patchByDoc", "entryPatches", "entryPatchByEntry"], "readwrite");
  await tx.objectStore("patches").put(patch);
  await tx.objectStore("entryPatches").put(patch);
  // Index the patch against every doc it touches
  const docIds = new Set<string>();
  for (const op of patch.operations) {
    if ("docId" in op) docIds.add(op.docId);
    if ("fields" in op && op.fields.id) docIds.add(op.fields.id as string);
    if ("entry" in op && op.entry?.id) docIds.add(op.entry.id as string);
    if ("entryId" in op) docIds.add(op.entryId as string);
    if ("relationship" in op) {
      docIds.add(op.relationship.from);
      docIds.add(op.relationship.to);
    }
    if ("relation" in op) {
      docIds.add(op.relation.from);
      docIds.add(op.relation.to);
    }
    if ("relationshipId" in op && op.op === "remove-relationship") {
      // No doc ID available without the relationship record; skip for now
    }
  }
  for (const docId of docIds) {
    await tx.objectStore("patchByDoc").put({ docId, patchId: patch.id, status: patch.status });
    await tx.objectStore("entryPatchByEntry").put({ docId, patchId: patch.id, status: patch.status });
  }
  await tx.done;
}

export async function updatePatchStatus(
  id: string,
  status: PersistedCanonicalPatch["status"]
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(["patches", "patchByDoc", "entryPatches", "entryPatchByEntry"], "readwrite");
  const existing = await tx.objectStore("patches").get(id);
  if (!existing) { await tx.done; return; }
  await tx.objectStore("patches").put({ ...existing, status });
  await tx.objectStore("entryPatches").put({ ...existing, status });
  // Update status on all patchByDoc index rows for this patchId
  const indexRows = await tx.objectStore("patchByDoc").index("by_patchId").getAll(id);
  for (const row of indexRows) {
    await tx.objectStore("patchByDoc").put({ ...row, status });
  }
  const entryRows = await tx.objectStore("entryPatchByEntry").index("by_patchId").getAll(id);
  for (const row of entryRows) {
    await tx.objectStore("entryPatchByEntry").put({ ...row, status });
  }
  await tx.done;
}

export async function getPendingPatches(): Promise<PersistedCanonicalPatch[]> {
  const db = await getDb();
  const next = await db.getAllFromIndex("entryPatches", "by_status", "pending");
  if (next.length > 0) return next;
  return db.getAllFromIndex("patches", "by_status", "pending");
}

export async function getPatchesForDoc(docId: string): Promise<PersistedCanonicalPatch[]> {
  const db = await getDb();
  const entryIndex = await db.getAllFromIndex("entryPatchByEntry", "by_entry", docId);
  if (entryIndex.length > 0) {
    const tx = db.transaction("entryPatches", "readonly");
    const rows = await Promise.all(entryIndex.map((entry) => tx.store.get(entry.patchId)));
    return rows.filter((row): row is PersistedCanonicalPatch => row !== undefined);
  }
  // Range scan via compound-key index: all rows where docId matches
  const entries = await db.getAllFromIndex("patchByDoc", "by_doc", docId);
  if (entries.length === 0) return [];
  const tx = db.transaction("patches", "readonly");
  const results = await Promise.all(entries.map((e) => tx.store.get(e.patchId)));
  return results.filter((p): p is PersistedCanonicalPatch => p !== undefined);
}

/* ==============================================================
   Schema version utilities (Plan 001 — Phase 3)
   ============================================================== */

/**
 * Check whether the stored schema version matches the current IDB_VERSION.
 * Returns `needsMigration: true` when the stored version falls behind,
 * prompting the app to show a migration banner.
 */
export async function checkSchemaVersion(): Promise<{ needsMigration: boolean; storedVersion: number | null }> {
  const storedVersion = await getMetadata<number>("schemaVersion");
  return {
    needsMigration: storedVersion !== null && storedVersion < DB_VERSION,
    storedVersion,
  };
}

/* ==============================================================
   Storage health & corpus-scale utilities
   (Phase 3 — IndexedDB performance ceiling, run001 research)
   ============================================================== */

/**
 * Record counts and estimated byte sizes for the IDB corpus.
 *
 * `navigator.storage.estimate()` is NOT used because Safari does not implement
 * it reliably. Instead we count records and estimate sizes from known shapes:
 * - Each embedding vector is 768 × 4 bytes (Float32) = 3 072 bytes
 * - Each RAG node is ~2 KB of JSON on average
 *
 * Performance cliff reference: Safari's IDB (SQLite-backed) shows >50 ms
 * transaction latency at ~10 000+ records, corresponding to ~500k words.
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

  // Count fragment sub-nodes via the by_parent index — all non-null parentIds
  const allNodes = await db.getAll("nodes");
  const fragmentCount = allNodes.filter((n) => n.type === "fragment").length;

  // Rough size estimate:
  //   embeddings: 768 dims × 4 bytes (float32) + ~100 bytes metadata
  //   nodes: ~2 KB JSON average
  const estimatedBytes =
    embeddingCount * (768 * 4 + 100) +
    nodeCount * 2048;

  // Warn at 70 % of the 10k cliff (≈7 000 combined fragment + embedding records)
  const nearPerformanceCliff = fragmentCount + embeddingCount > 7_000;

  return { nodeCount, fragmentCount, embeddingCount, estimatedBytes, nearPerformanceCliff };
}

/**
 * Attempts to detect private-browsing mode and verify that IndexedDB is writable.
 *
 * Safari in private browsing sets IDB quota to **zero** — any write immediately
 * throws `QuotaExceededError`. This function performs a cheap probe write so callers
 * can surface a warning before the user loses indexing progress.
 *
 * `navigator.storage.estimate()` is intentionally NOT called — it is unsupported
 * on Safari (returns `undefined` rather than throwing, making it silently useless).
 *
 * Returns:
 * - `ok`: IDB is writable and available.
 * - `privateMode`: write was rejected with QuotaExceededError — likely private browsing.
 * - `unavailable`: IDB itself is absent (SSR, WebWorker without IDB, sandboxed iframe).
 */
export type StorageHealthStatus = "ok" | "privateMode" | "unavailable";

export async function checkStorageHealth(): Promise<StorageHealthStatus> {
  if (typeof indexedDB === "undefined") return "unavailable";

  try {
    const db = await getDb();
    // A metadata upsert is idempotent and tiny — safe as a probe.
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

/**
 * Factory to obtain a RAGStore backed by IndexedDB.
 */
export async function createRAGStore(): Promise<RAGStore> {
  return {
    putNode,
    getNode,
    deleteNode,
    listChildren,
    listAllNodes,
    putEmbedding,
    getEmbeddingByFragment,
    getEmbeddingByHash,
    setMetadata,
    getMetadata,
    putChatSession,
    listChatSessions,
    listChatSessionsByLibrary,
    deleteChatSession,
    putChatMessages,
    listChatMessages,
    putCharacter,
    getCharactersByLibrary,
    deleteCharacter,
    putLocation,
    getLocationsByLibrary,
    deleteLocation,
    putWorldEntry,
    getWorldEntriesByLibrary,
    deleteWorldEntry,
    putStory,
    getStoriesByLibrary,
    getStory,
    deleteStory,
    deleteStoryCascade,
    deleteLibraryCascade,
    putLibraryMeta,
    getLibraryMeta,
    deleteLibraryMeta,
    putAiLibrarySettings,
    getAiLibrarySettings,
    deleteAiLibrarySettings,
    putResearchRun,
    getResearchRun,
    listResearchRunsByLibrary,
    putResearchArtifact,
    listResearchArtifacts,
    putUsageLedger,
    getUsageLedger,
    putUniverse,
    getUniverse,
    listUniverses,
    addEntry,
    updateEntry,
    getEntryById,
    listEntriesByUniverse,
    queryEntriesByType,
    deleteEntry,
    putSeries,
    listSeriesByUniverse,
    putBook,
    listBooksBySeries,
    listBooksByUniverse,
    putChapter,
    listChaptersByBook,
    putScene,
    listScenesByChapter,
    getSceneById,
    addEntryRelation,
    removeEntryRelation,
    getEntryRelationsForEntry,
    putTimeline,
    listTimelinesByUniverse,
    listTimelinesByBook,
    putEra,
    listErasByTimeline,
    putEvent,
    listEventsByUniverse,
    listEventsByEra,
    putCalendar,
    listCalendarsByUniverse,
    putTimeAnchor,
    getTimeAnchor,
    listTimeAnchorsByCalendar,
    putMembership,
    listMembershipsByCharacter,
    listMembershipsByOrganization,
    putCultureMembership,
    listCultureMembershipsByCharacter,
    listCultureMembershipsByCulture,
    putItemOwnership,
    listItemOwnershipByItem,
    listItemOwnershipByOwner,
    putMention,
    listMentionsByScene,
    listMentionsByEntry,
    putMedia,
    listMediaByUniverse,
    putMap,
    listMapsByUniverse,
    putMapPin,
    listMapPinsByMap,
    listMapPinsByEntry,
    addCultureVersion,
    listCultureVersionsByCulture,
    addOrganizationVersion,
    listOrganizationVersionsByOrganization,
    addReligionVersion,
    listReligionVersionsByReligion,
    addContinuityIssue,
    listContinuityIssuesByUniverse,
    updateContinuityIssueStatus,
    addSuggestion,
    listSuggestionsByUniverse,
    updateSuggestionStatus,
    addRevision,
    listRevisionsForTarget,
    addEntryPatch,
    getPendingEntryPatches,
    listAllEntryPatches,
    getEntryPatchesForEntry,
    addDoc,
    updateDoc,
    getDocById,
    queryDocsByType,
    deleteDoc,
    addRelationship,
    removeRelationship,
    getRelationsForDoc,
    addPatch,
    updatePatchStatus,
    getPendingPatches,
    getPatchesForDoc,
    checkSchemaVersion,
  };
}
