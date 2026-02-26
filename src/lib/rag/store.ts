/**
 * RAG storage contracts and persistable record shapes.
 * These types are shared by the IndexedDB layer and worker messages.
 */

import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";

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
}

/** Persisted location record, library-scoped. */
export interface PersistedLocation {
  id: string;
  libraryId: string;
  name: string;
  description: string;
  updatedAt: number;
}

/** Persisted world-entry record, library-scoped. */
export interface PersistedWorldEntry {
  id: string;
  libraryId: string;
  title: string;
  category: string;
  notes: string;
  updatedAt: number;
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
  putCharacter(entry: PersistedCharacter): Promise<void>;
  getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]>;
  deleteCharacter(id: string): Promise<void>;
  // Locations
  putLocation(entry: PersistedLocation): Promise<void>;
  getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]>;
  deleteLocation(id: string): Promise<void>;
  // World entries
  putWorldEntry(entry: PersistedWorldEntry): Promise<void>;
  getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]>;
  deleteWorldEntry(id: string): Promise<void>;
  // Stories
  putStory(entry: PersistedStory): Promise<void>;
  getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]>;
  getStory(id: string): Promise<PersistedStory | null>;
  deleteStory(id: string): Promise<void>;
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
