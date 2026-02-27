/**
 * RAG storage contracts and persistable record shapes.
 * These types are shared by the IndexedDB layer and worker messages.
 */

import type { RAGNode } from "@/lib/rag/hierarchy";
import type {
  AiLibrarySettings,
  CanonicalDoc,
  CanonicalPatch,
  CanonicalType,
  Relationship,
  ResearchArtifact,
  ResearchRunRecord,
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

/** Canonical document stored directly as-is — shape matches CanonicalDoc. */
export type PersistedCanonicalDoc = CanonicalDoc;

/** Relationship edge stored directly as-is — shape matches Relationship. */
export type PersistedRelationship = Relationship;

/** Canonical patch stored directly as-is — shape matches CanonicalPatch. */
export type PersistedCanonicalPatch = CanonicalPatch;

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
  status: CanonicalPatch["status"];
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

/**
 * High-level storage interface to keep persistence concerns isolated.
 */
export interface RAGStore {
  putNode(node: RAGNode): Promise<void>;
  getNode(id: string): Promise<RAGNode | null>;
  deleteNode(id: string): Promise<void>;
  listChildren(parentId: string | null): Promise<RAGNode[]>;
  listAllNodes(): Promise<RAGNode[]>;
  putEmbedding(record: StoredEmbedding): Promise<void>;
  getEmbeddingByFragment(fragmentId: string): Promise<StoredEmbedding | null>;
  getEmbeddingByHash(hash: string, model: string): Promise<StoredEmbedding | null>;
  setMetadata(entry: StoredMetadata): Promise<void>;
  getMetadata<T = unknown>(key: string): Promise<T | null>;
  // Chat persistence
  putChatSession(session: PersistedChatSession): Promise<void>;
  listChatSessions(): Promise<PersistedChatSession[]>;
  listChatSessionsByLibrary(libraryId: string): Promise<PersistedChatSession[]>;
  deleteChatSession(id: string): Promise<void>;
  putChatMessages(sessionId: string, messages: { role: "user" | "assistant"; content: string }[]): Promise<void>;
  listChatMessages(sessionId: string): Promise<PersistedChatMessage[]>;
  // Characters
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putCharacter(entry: PersistedCharacter): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("character")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteCharacter(id: string): Promise<void>;
  // Locations
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putLocation(entry: PersistedLocation): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("location")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteLocation(id: string): Promise<void>;
  // World entries
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  putWorldEntry(entry: PersistedWorldEntry): Promise<void>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]>;
  /** @deprecated Legacy store — use `canonicalDocs` via `queryDocsByType("lore_entry")`. Will be removed in the v9 IDB upgrade once migration is confirmed. */
  deleteWorldEntry(id: string): Promise<void>;
  // Stories
  putStory(entry: PersistedStory): Promise<void>;
  getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]>;
  getStory(id: string): Promise<PersistedStory | null>;
  deleteStory(id: string): Promise<void>;
  deleteStoryCascade(storyId: string): Promise<void>;
  deleteLibraryCascade(libraryId: string): Promise<void>;
  // Library metadata
  putLibraryMeta(entry: PersistedLibraryMeta): Promise<void>;
  getLibraryMeta(libraryId: string): Promise<PersistedLibraryMeta | null>;
  deleteLibraryMeta(libraryId: string): Promise<void>;
  // AI settings
  putAiLibrarySettings(entry: PersistedAiLibrarySettings): Promise<void>;
  getAiLibrarySettings(libraryId: string): Promise<PersistedAiLibrarySettings | null>;
  deleteAiLibrarySettings(libraryId: string): Promise<void>;
  // Deep research runs / artifacts / usage
  putResearchRun(entry: PersistedResearchRun): Promise<void>;
  getResearchRun(id: string): Promise<PersistedResearchRun | null>;
  listResearchRunsByLibrary(libraryId: string): Promise<PersistedResearchRun[]>;
  putResearchArtifact(entry: PersistedResearchArtifact): Promise<void>;
  listResearchArtifacts(runId: string): Promise<PersistedResearchArtifact[]>;
  putUsageLedger(entry: PersistedUsageLedger): Promise<void>;
  getUsageLedger(runId: string): Promise<PersistedUsageLedger | null>;
  // Canonical documents (Plan 001 — Phase 3)
  addDoc(doc: PersistedCanonicalDoc): Promise<void>;
  updateDoc(id: string, patch: Partial<PersistedCanonicalDoc>): Promise<void>;
  getDocById(id: string): Promise<PersistedCanonicalDoc | undefined>;
  queryDocsByType(type: CanonicalType): Promise<PersistedCanonicalDoc[]>;
  deleteDoc(id: string): Promise<void>;
  // Relationships
  addRelationship(rel: PersistedRelationship): Promise<void>;
  removeRelationship(id: string): Promise<void>;
  getRelationsForDoc(docId: string): Promise<PersistedRelationship[]>;
  // Patches
  addPatch(patch: PersistedCanonicalPatch): Promise<void>;
  updatePatchStatus(id: string, status: PersistedCanonicalPatch["status"]): Promise<void>;
  getPendingPatches(): Promise<PersistedCanonicalPatch[]>;
  getPatchesForDoc(docId: string): Promise<PersistedCanonicalPatch[]>;
  // Schema version utilities
  checkSchemaVersion(): Promise<{ needsMigration: boolean; storedVersion: number | null }>;
}

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
