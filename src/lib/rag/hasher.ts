/**
 * SHA-256 Fragment Hashing for RAG Cache Invalidation
 *
 * Only re-vectorize a fragment if its hash changes, preventing RAG-processing bloat.
 * Uses the Web Crypto API (available in modern browsers and Node.js).
 */

import { cosineSimilarity } from "@/lib/rag/search";

/**
 * Hash a fragment's content using SHA-256
 * Returns a hex string
 */
export async function hashFragment(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);

  // Use Web Crypto API (available in browser and Node.js 15+)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return hashHex;
}

/**
 * Batch hash multiple fragments efficiently
 */
export async function hashFragments(
  contents: string[]
): Promise<Map<number, string>> {
  const hashes = new Map<number, string>();
  const promises = contents.map((content, index) =>
    hashFragment(content).then((hash) => {
      hashes.set(index, hash);
    })
  );

  await Promise.all(promises);
  return hashes;
}

/**
 * Check if a fragment has changed by comparing hashes
 */
export async function hasFragmentChanged(
  newContent: string,
  oldHash: string
): Promise<boolean> {
  const newHash = await hashFragment(newContent);
  return newHash !== oldHash;
}

/**
 * Debounced hash function (for rapid edits)
 * Returns a function that debounces hash computation
 */
export function createDebouncedHasher(delayMs: number = 500) {
  let timeoutId: NodeJS.Timeout | null = null;
  let pendingContent: string | null = null;
  let pendingResolve: ((hash: string) => void) | null = null;

  return async function debouncedHash(content: string): Promise<string> {
    pendingContent = content;

    return new Promise((resolve) => {
      pendingResolve = resolve;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(async () => {
        if (pendingContent !== null) {
          const hash = await hashFragment(pendingContent);
          if (pendingResolve) {
            pendingResolve(hash);
          }
        }
        timeoutId = null;
      }, delayMs);
    });
  };
}

/**
 * Semantic hash (fingerprint of normalised text content).
 * Used as a fast deduplication key: two fragments with the same semantic hash
 * are treated as identical without needing an embedding round-trip.
 */
export async function semanticHash(content: string): Promise<string> {
  // For now, use a simple hash of normalized content
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return hashFragment(normalized);
}

// ---------------------------------------------------------------------------
// Internal helpers for embedding-based similarity
// ---------------------------------------------------------------------------

/**
 * Fetch a single embedding vector from the local embeddings proxy.
 * Returns `null` if the request fails or the response is malformed.
 * Uses a relative URL so this works in both browser and Web-Worker contexts
 * (Web Workers resolve relative URLs against the page origin).
 */
async function fetchEmbedding(
  content: string,
  model: string,
): Promise<Float32Array | null> {
  try {
    const response = await fetch("/api/embeddings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ input: content, model }),
    });
    if (!response.ok) return null;
    const json = (await response.json()) as { embedding?: number[] };
    if (!Array.isArray(json.embedding) || json.embedding.length === 0) return null;
    return new Float32Array(json.embedding);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Semantic similarity
// ---------------------------------------------------------------------------

/**
 * Compare two fragments for semantic similarity using embedding-based cosine
 * distance.  Falls back to exact-hash equality when Ollama embeddings are
 * unavailable (e.g., server not running, network error).
 *
 * Returns a score in [0, 1] where 1 = identical / maximally similar.
 *
 * @param content1 First fragment text.
 * @param content2 Second fragment text.
 * @param model    Ollama embedding model to use (default: "nomic-embed-text").
 */
export async function fragmentSimilarity(
  content1: string,
  content2: string,
  model = "nomic-embed-text",
): Promise<number> {
  if (!content1.trim() || !content2.trim()) return 0;

  // Fast path: identical content → similarity 1 without an API round-trip.
  const [hash1, hash2] = await Promise.all([
    semanticHash(content1),
    semanticHash(content2),
  ]);
  if (hash1 === hash2) return 1;

  // Embedding path: fetch both vectors in parallel, compute cosine similarity.
  try {
    const [vec1, vec2] = await Promise.all([
      fetchEmbedding(content1, model),
      fetchEmbedding(content2, model),
    ]);
    if (!vec1 || !vec2) return 0;
    return cosineSimilarity(vec1, vec2);
  } catch {
    // Graceful degradation: Ollama unavailable or embedding endpoint unreachable.
    return 0;
  }
}
