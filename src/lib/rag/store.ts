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
