/**
 * Fragment embedding pipeline.
 *
 * Responsible for:
 * - Deduplicating by content hash + model (no re-embed if unchanged)
 * - Calling /api/embeddings to get a vector
 * - Persisting the StoredEmbedding to IndexedDB via RAGStore
 *
 * All errors are caught and surfaced as `null` — embedding failures are
 * non-fatal and must not block hashing or saving.
 */

import type { RAGStore, StoredEmbedding } from "./store";

/**
 * Embeds `content` for `fragmentId`, persists the result, and returns it.
 *
 * Dedup logic:
 * - If an embedding with the same `hash` and `model` already exists in IDB,
 *   it is reused (updates `fragmentId` pointer if needed, then returns early).
 * - Otherwise a fresh `/api/embeddings` call is made.
 *
 * Returns `null` when:
 * - Content is empty
 * - Ollama is unreachable or returns a non-OK status
 * - The response payload is malformed
 */
export async function embedNode(
  fragmentId: string,
  content: string,
  hash: string,
  model: string,
  store: RAGStore,
): Promise<StoredEmbedding | null> {
  if (!content.trim()) return null;

  // --- Deduplication: same content hash + model already indexed ---
  try {
    const existing = await store.getEmbeddingByHash(hash, model);
    if (existing) {
      // Re-associate if the same content moved to a different node (e.g. paste/move)
      if (existing.fragmentId !== fragmentId) {
        const updated: StoredEmbedding = { ...existing, fragmentId };
        await store.putEmbedding(updated);
        return updated;
      }
      return existing;
    }
  } catch {
    // IDB read failure — fall through and attempt a fresh embed
  }

  // --- Call Ollama via the local proxy ---
  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: content, model }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { embedding: number[]; model: string };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) return null;

    const record: StoredEmbedding = {
      fragmentId,
      hash,
      model: data.model ?? model,
      dimensions: data.embedding.length,
      vector: data.embedding,
      createdAt: Date.now(),
    };

    await store.putEmbedding(record);
    return record;
  } catch {
    // Ollama down, network error, JSON parse failure — silently degrade
    return null;
  }
}
