/**
 * SHA-256 Fragment Hashing for RAG Cache Invalidation
 *
 * Only re-vectorize a fragment if its hash changes, preventing RAG-processing bloat.
 * Uses the Web Crypto API (available in modern browsers and Node.js).
 */

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
 * Semantic hash (fingerprint of conceptual content)
 * Useful for deduplication across similar fragments
 * This is a placeholder; a full implementation would use embeddings or semantic analysis
 */
export async function semanticHash(content: string): Promise<string> {
  // For now, use a simple hash of normalized content
  const normalized = content
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

  return hashFragment(normalized);
}

/**
 * Compare two fragments for semantic similarity (placeholder)
 * Returns a similarity score 0-1 (1 = identical)
 */
export async function fragmentSimilarity(
  content1: string,
  content2: string
): Promise<number> {
  const hash1 = await semanticHash(content1);
  const hash2 = await semanticHash(content2);

  // For now, exact match only
  return hash1 === hash2 ? 1 : 0;

  // TODO: Implement proper semantic similarity using embeddings
}
