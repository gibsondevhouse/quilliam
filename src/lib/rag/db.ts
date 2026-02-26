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
  type PersistedChatMessage,
  type PersistedChatSession,
  type PersistedRAGNode,
  type RAGStore,
  type StoredEmbedding,
  type StoredMetadata,
} from "@/lib/rag/store";

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
    indexes: { by_updated: number };
  };
  chatMessages: {
    key: string;
    value: PersistedChatMessage;
    indexes: { by_session: string };
  };
}

interface PersistedEmbedding extends StoredEmbedding {
  key: string; // fragmentId
  hashModel: string; // `${hash}::${model}` for fast lookup
}

const DB_NAME = "quilliam-rag";
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<RAGDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<RAGDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RAGDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(database) {
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
        }

        if (!database.objectStoreNames.contains("chatMessages")) {
          const msgs = database.createObjectStore("chatMessages", { keyPath: "key" });
          msgs.createIndex("by_session", "sessionId");
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

  const embeddingIndex = tx.objectStore("embeddings").index("by_fragment");
  let cursor = await embeddingIndex.openCursor(id);
  while (cursor) {
    await cursor.delete();
    cursor = await cursor.continue();
  }

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
    deleteChatSession,
    putChatMessages,
    listChatMessages,
  };
}
