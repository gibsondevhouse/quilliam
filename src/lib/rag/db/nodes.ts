import type { RAGNode } from "@/lib/rag/hierarchy";
import {
  materializeEmbedding,
  materializeNode,
  serializeNode,
  type StoredEmbedding,
  type StoredMetadata,
} from "@/lib/rag/store";
import type { NodeStore } from "@/lib/rag/store/NodeStore";
import type { QuillDB } from "./schema";
import { deleteEmbeddingForFragment } from "./helpers";

function toPersistedEmbedding(record: StoredEmbedding) {
  return {
    ...record,
    key: record.fragmentId,
    hashModel: `${record.hash}::${record.model}`,
  };
}

export function createNodeStore(db: QuillDB): NodeStore {
  return {
    async putNode(node: RAGNode): Promise<void> {
      await db.put("nodes", serializeNode(node));
    },

    async getNode(id: string): Promise<RAGNode | null> {
      const record = await db.get("nodes", id);
      return record ? materializeNode(record) : null;
    },

    async deleteNode(id: string): Promise<void> {
      const tx = db.transaction(["nodes", "embeddings"], "readwrite");
      await tx.objectStore("nodes").delete(id);
      await deleteEmbeddingForFragment(tx, id);
      await tx.done;
    },

    async listChildren(parentId: string | null): Promise<RAGNode[]> {
      const records = await db.getAllFromIndex("nodes", "by_parent", parentId);
      return records.map(materializeNode);
    },

    async listAllNodes(): Promise<RAGNode[]> {
      const records = await db.getAll("nodes");
      return records.map(materializeNode);
    },

    async putEmbedding(record: StoredEmbedding): Promise<void> {
      await db.put("embeddings", toPersistedEmbedding(record));
    },

    async getEmbeddingByFragment(fragmentId: string): Promise<StoredEmbedding | null> {
      const index = db.transaction("embeddings", "readonly").store.index("by_fragment");
      const match = await index.get(fragmentId);
      return match ? materializeEmbedding(match) : null;
    },

    async getEmbeddingByHash(hash: string, model: string): Promise<StoredEmbedding | null> {
      const index = db.transaction("embeddings", "readonly").store.index("by_hash_model");
      const match = await index.get(`${hash}::${model}`);
      return match ? materializeEmbedding(match) : null;
    },

    async setMetadata(entry: StoredMetadata): Promise<void> {
      await db.put("metadata", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },

    async getMetadata<T = unknown>(key: string): Promise<T | null> {
      const record = await db.get("metadata", key);
      return record ? (record.value as T) : null;
    },
  };
}
