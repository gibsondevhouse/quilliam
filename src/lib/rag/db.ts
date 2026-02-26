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
  type PersistedCharacter,
  type PersistedLibraryMeta,
  type PersistedLocation,
  type PersistedWorldEntry,
  type PersistedStory,
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
}

interface PersistedEmbedding extends StoredEmbedding {
  key: string; // fragmentId
  hashModel: string; // `${hash}::${model}` for fast lookup
}

function libraryMetaKey(libraryId: string): string {
  return `library-meta:${libraryId}`;
}

const DB_NAME = "quilliam-rag";
const DB_VERSION = 4;

let dbPromise: Promise<IDBPDatabase<RAGDBSchema>> | null = null;

function getDb(): Promise<IDBPDatabase<RAGDBSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<RAGDBSchema>(DB_NAME, DB_VERSION, {
      upgrade(database, oldVersion, _newVersion, transaction) {
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
    ["nodes", "embeddings", "metadata", "chatSessions", "chatMessages", "characters", "locations", "worldEntries", "stories"],
    "readwrite",
  );

  for (const nodeId of nodeIds) {
    await tx.objectStore("nodes").delete(nodeId);
    await deleteEmbeddingForFragment(tx, nodeId);
  }

  await tx.objectStore("metadata").delete(libraryMetaKey(libraryId));

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
  };
}
