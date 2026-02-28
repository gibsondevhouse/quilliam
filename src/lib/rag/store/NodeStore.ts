import type { RAGNode } from "@/lib/rag/hierarchy";
import type { StoredEmbedding, StoredMetadata } from "@/lib/rag/store";

export interface NodeStore {
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
