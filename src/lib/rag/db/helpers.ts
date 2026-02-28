/**
 * Internal helpers shared across db domain modules.
 * Not part of the public RAGStore API.
 */

import type { QuillDB } from "./schema";
import { materializeNode } from "@/lib/rag/store";

/**
 * Delete all embeddings associated with a given fragment node.
 * Must be called within an active writable transaction that includes "embeddings".
 */
export async function deleteEmbeddingForFragment(
  tx: ReturnType<QuillDB["transaction"]>,
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

/**
 * Collect all node IDs in the subtree rooted at `rootId` (BFS, inclusive).
 */
export async function collectCascadeNodeIds(db: QuillDB, rootId: string): Promise<string[]> {
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
