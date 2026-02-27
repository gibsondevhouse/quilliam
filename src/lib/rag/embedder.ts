/**
 * Fragment embedding pipeline.
 *
 * Responsible for:
 * - Deduplicating by content hash + model (no re-embed if unchanged)
 * - Calling /api/embeddings to get a vector
 * - Persisting the StoredEmbedding to IndexedDB via RAGStore
 *
 * All errors are caught and surfaced as a typed failure result — embedding
 * failures are non-fatal and must not block hashing or saving.
 */

import type { RAGStore, StoredEmbedding } from "./store";

export type EmbedNodeCacheLookup = "hit" | "miss" | "lookup_failed";

export type EmbedNodeResult =
  | {
      ok: true;
      source: "cache" | "network";
      cacheLookup: EmbedNodeCacheLookup;
      embedding: StoredEmbedding;
    }
  | {
      ok: false;
      reason: "empty_content" | "network_failure" | "invalid_payload";
      cacheLookup: EmbedNodeCacheLookup;
      error?: string;
    };

/**
 * Embeds `content` for `fragmentId`, persists the result, and returns it.
 *
 * Dedup logic:
 * - If an embedding with the same `hash` and `model` already exists in IDB,
 *   it is reused (updates `fragmentId` pointer if needed, then returns early).
 * - Otherwise a fresh `/api/embeddings` call is made.
 *
 * Returns a typed failure when:
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
): Promise<EmbedNodeResult> {
  if (!content.trim()) {
    return { ok: false, reason: "empty_content", cacheLookup: "miss" };
  }

  let cacheLookup: EmbedNodeCacheLookup = "miss";

  // --- Deduplication: same content hash + model already indexed ---
  try {
    const existing = await store.getEmbeddingByHash(hash, model);
    if (existing) {
      cacheLookup = "hit";
      // Re-associate if the same content moved to a different node (e.g. paste/move)
      if (existing.fragmentId !== fragmentId) {
        const updated: StoredEmbedding = { ...existing, fragmentId };
        await store.putEmbedding(updated);
        return {
          ok: true,
          source: "cache",
          cacheLookup,
          embedding: updated,
        };
      }
      return {
        ok: true,
        source: "cache",
        cacheLookup,
        embedding: existing,
      };
    }
  } catch {
    cacheLookup = "lookup_failed";
    console.error("Embed cache lookup failed", { fragmentId, model, hash });
  }

  // --- Call Ollama via the local proxy ---
  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: content, model }),
    });

    if (!response.ok) {
      return {
        ok: false,
        reason: "network_failure",
        cacheLookup,
        error: `Embeddings API returned ${response.status}`,
      };
    }

    const data = (await response.json()) as { embedding: number[]; model: string };
    if (!Array.isArray(data.embedding) || data.embedding.length === 0) {
      return {
        ok: false,
        reason: "invalid_payload",
        cacheLookup,
        error: "Embeddings payload did not include a non-empty vector",
      };
    }

    const record: StoredEmbedding = {
      fragmentId,
      hash,
      model: data.model ?? model,
      dimensions: data.embedding.length,
      vector: data.embedding,
      createdAt: Date.now(),
    };

    await store.putEmbedding(record);
    return {
      ok: true,
      source: "network",
      cacheLookup,
      embedding: record,
    };
  } catch {
    return {
      ok: false,
      reason: "network_failure",
      cacheLookup,
      error: "Network error while requesting embeddings",
    };
  }
}
