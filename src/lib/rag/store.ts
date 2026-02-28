/**
 * RAG storage contracts and persistable record shapes.
 * These types are shared by the IndexedDB layer and worker messages.
 */

import type { RAGNode } from "@/lib/rag/hierarchy";
import type {
  AiLibrarySettings,
  Book,
  Calendar,
  Chapter,
  ContinuityIssue,
  CultureMembership,
  CultureVersion,
  Entry,
  EntryPatch,
  Era,
  Event,
  ItemOwnership,
  Map as WorldMap,
  MapPin,
  Media,
  Mention,
  Membership,
  OrganizationVersion,
  ReligionVersion,
  Revision,
  Relationship,
  ResearchArtifact,
  ResearchRunRecord,
  Scene,
  Series,
  Suggestion,
  TimeAnchor,
  Timeline,
  Universe,
  UsageMeter,
} from "@/lib/types";

/**
 * Persisted RAG node representation suitable for IndexedDB storage.
 * Float32Array embeddings are flattened to number[] for structured cloning.
 */
export interface PersistedRAGNode extends Omit<RAGNode, "vectorEmbedding"> {
  vectorEmbedding?: number[];
}

/**
 * Stored embedding metadata keyed by fragment hash and model.
 */
export interface StoredEmbedding {
  fragmentId: string;
  hash: string;
  model: string;
  dimensions: number;
  vector: number[];
  createdAt: number;
}

/**
 * Generic metadata entry for versioning or feature flags.
 */
export interface StoredMetadata {
  key: string;
  value: unknown;
  updatedAt: number;
}

/**
 * Persisted chat session header (no messages — stored separately for fast listing).
 * libraryId is required for all new sessions; legacy rows may have it undefined.
 */
export interface PersistedChatSession {
  id: string;
  libraryId?: string;
  title: string;
  preview: string;
  createdAt: number;
  updatedAt: number;
}

/** Persisted character record, library-scoped. */
export interface PersistedCharacter {
  id: string;
  libraryId: string;
  name: string;
  role: string;
  notes: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted location record, library-scoped. */
export interface PersistedLocation {
  id: string;
  libraryId: string;
  name: string;
  description: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted world-entry record, library-scoped. */
export interface PersistedWorldEntry {
  id: string;
  libraryId: string;
  title: string;
  category: string;
  notes: string;
  updatedAt: number;
  /** Set to true after the one-time canonical migration is confirmed. */
  migrated?: boolean;
}

/** Persisted story (book/novel) record — library-scoped, contains chapters. */
export interface PersistedStory {
  id: string;
  libraryId: string;
  title: string;
  synopsis: string;
  genre: string;
  status: "drafting" | "editing" | "archived";
  createdAt: number;
  updatedAt: number;
}

/** Persisted library metadata separate from the core RAG node shape. */
export interface PersistedLibraryMeta {
  libraryId: string;
  title: string;
  description: string;
  status: "drafting" | "editing" | "archived";
  updatedAt: number;
}

/** Per-library AI execution and provider preferences. */
export type PersistedAiLibrarySettings = AiLibrarySettings;

/** Durable research run state used by the Deep Research monitor. */
export type PersistedResearchRun = ResearchRunRecord;

/** Persisted research artifact emitted by deep-research phases. */
export type PersistedResearchArtifact = ResearchArtifact;

/** Persisted usage meter snapshots keyed by run id. */
export interface PersistedUsageLedger {
  runId: string;
  usage: UsageMeter;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Canonical document persistence types (Plan 001 — Phase 3)
// ---------------------------------------------------------------------------

/** Canonical document stored directly as-is — shape matches Entry. */
export type PersistedCanonicalDoc = Entry;

/** Relationship edge stored directly as-is — shape matches Relationship. */
export type PersistedRelationship = Relationship;

/** Canonical patch stored directly as-is — shape matches EntryPatch. */
export type PersistedCanonicalPatch = EntryPatch;

/** Plan-002 universe-level records */
export type PersistedUniverse = Universe;
export type PersistedEntry = Entry;
export type PersistedEntryPatch = EntryPatch;
export type PersistedSeries = Series;
export type PersistedBook = Book;
export type PersistedChapter = Chapter;
export type PersistedScene = Scene;
export type PersistedTimeline = Timeline;
export type PersistedEra = Era;
export type PersistedEvent = Event;
export type PersistedCalendar = Calendar;
export type PersistedTimeAnchor = TimeAnchor;
export type PersistedMembership = Membership;
export type PersistedCultureMembership = CultureMembership;
export type PersistedItemOwnership = ItemOwnership;
export type PersistedCultureVersion = CultureVersion;
export type PersistedOrganizationVersion = OrganizationVersion;
export type PersistedReligionVersion = ReligionVersion;
export type PersistedContinuityIssue = ContinuityIssue;
export type PersistedSuggestion = Suggestion;
export type PersistedRevision = Revision;
export type PersistedMention = Mention;
export type PersistedMedia = Media;
export type PersistedMap = WorldMap;
export type PersistedMapPin = MapPin;

/**
 * Denormalised lookup entry: one row per (docId, relationshipId) pair.
 * Stored in the `relationIndexByDoc` object store.
 * keyPath: ["docId", "relationshipId"]  ← compound, NOT scalar
 */
export interface PersistedRelationIndexEntry {
  /** The canonical doc ID (part of compound key). */
  docId: string;
  /** The relationship ID that involves this doc (as `from` or `to`). */
  relationshipId: string;
}

/**
 * Lookup entry: one row per (docId, patchId) pair.
 * Stored in the `patchByDoc` object store for fast patch lookups by doc.
 * keyPath: ["docId", "patchId"]  ← compound, NOT scalar
 */
export interface PersistedPatchByDocEntry {
  /** The canonical doc ID (part of compound key). */
  docId: string;
  /** The patch ID that touches this doc in one of its operations. */
  patchId: string;
  /** Denormalised status for index-based filtering. */
  status: EntryPatch["status"];
}

/**
 * Individual chat message keyed by session.
 */
export interface PersistedChatMessage {
  /** Composite key: `${sessionId}::${index}` */
  key: string;
  sessionId: string;
  index: number;
  role: "user" | "assistant";
  content: string;
  createdAt: number;
}

import type { ChatStore } from "./store/ChatStore";
import type { EntryStore } from "./store/EntryStore";
import type { ManuscriptStore } from "./store/ManuscriptStore";
import type { MediaStore } from "./store/MediaStore";
import type { NodeStore } from "./store/NodeStore";
import type { PatchStore } from "./store/PatchStore";
import type { RelationStore } from "./store/RelationStore";
import type { ResearchStore } from "./store/ResearchStore";
import type { TimelineStore } from "./store/TimelineStore";

/**
 * High-level storage interface — composed from domain sub-store interfaces.
 * Defined here so all existing `import type { RAGStore } from "@/lib/rag/store"`
 * imports continue to work without modification.
 */
export type RAGStore = NodeStore &
  ChatStore &
  EntryStore &
  ManuscriptStore &
  TimelineStore &
  RelationStore &
  ResearchStore &
  MediaStore &
  PatchStore & {
    /** Check whether the persisted schema version is behind the current DB version. */
    checkSchemaVersion(): Promise<{ needsMigration: boolean; storedVersion: number | null }>;
    /** Delete all data owned by a library, atomically across all stores. */
    deleteLibraryCascade(libraryId: string): Promise<void>;
    /** Delete a story and its RAG node tree. */
    deleteStoryCascade(storyId: string): Promise<void>;
  };

/**
 * Helper to normalize a persisted node back to a runtime RAGNode.
 */
export function materializeNode(record: PersistedRAGNode): RAGNode {
  const { vectorEmbedding, ...rest } = record;
  return {
    ...rest,
    vectorEmbedding: vectorEmbedding ? new Float32Array(vectorEmbedding) : undefined,
  };
}

/**
 * Helper to flatten a runtime node for IndexedDB storage.
 */
export function serializeNode(node: RAGNode): PersistedRAGNode {
  const { vectorEmbedding, ...rest } = node;
  return {
    ...rest,
    vectorEmbedding: vectorEmbedding ? Array.from(vectorEmbedding) : undefined,
  };
}

/**
 * Helper to strip indexing helper field when reading embedding records.
 */
export function materializeEmbedding(record: StoredEmbedding): StoredEmbedding {
  return { ...record };
}
