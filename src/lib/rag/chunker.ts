/**
 * Long-document chunking for RAG sub-fragments.
 *
 * Scenes that exceed ~750 tokens (~3 000 characters) are split into
 * overlapping fragments of ~500 tokens each so the vector database can
 * retrieve precise passages rather than averaging over an entire scene.
 *
 * Strategy
 * --------
 * 1. Split on paragraph boundaries (\n\n) — preserves prose structure.
 * 2. Build chunks greedily until the target character budget is exceeded.
 * 3. Each new chunk begins with an overlap window taken from the end of
 *    the previous chunk (~200 chars / ~50 tokens) for continuity.
 * 4. Returns ready-to-store `RAGNode` records (type "fragment").
 *
 * Sub-fragment IDs are deterministic:  `${parentId}::frag::${index}`
 * This allows stale fragments to be discovered and deleted by ID without
 * an extra IDB index scan.
 */

import { FRAGMENT_TARGET_TOKENS, estimateTokenCount, createRAGNode } from "./hierarchy";
import type { RAGNode } from "./hierarchy";
import { hashFragment } from "./hasher";

/** Multiplier above target at which we bother splitting (avoids micro-chunks). */
export const CHUNK_SPLIT_THRESHOLD = 1.5;

/** Overlap in characters prepended to each new chunk for context continuity. */
const OVERLAP_CHARS = 200;

/**
 * Returns a deterministic sub-fragment ID for a given parent + chunk index.
 * Format: `<parentId>::frag::<index>`
 */
export function fragmentId(parentId: string, index: number): string {
  return `${parentId}::frag::${index}`;
}

/**
 * Returns true when `content` is long enough to warrant chunking.
 */
export function needsChunking(content: string): boolean {
  return estimateTokenCount(content) > FRAGMENT_TARGET_TOKENS * CHUNK_SPLIT_THRESHOLD;
}

/**
 * Splits `content` into an array of overlapping text chunks.
 * Each chunk targets `FRAGMENT_TARGET_TOKENS` tokens (~500).
 * Returns a single-element array (the full content) when no split is needed.
 */
function splitContent(content: string): string[] {
  const targetChars = FRAGMENT_TARGET_TOKENS * 4;

  // Split on blank-line paragraph boundaries; keep the separator
  const paragraphs = content.split(/(\n\n+)/);
  const chunks: string[] = [];
  let current = "";

  for (const segment of paragraphs) {
    if (current.length + segment.length > targetChars && current.trim()) {
      chunks.push(current.trimEnd());
      // Seed the next chunk with the overlap tail of the previous one
      const overlap = current.length > OVERLAP_CHARS ? current.slice(-OVERLAP_CHARS) : current;
      current = overlap + segment;
    } else {
      current += segment;
    }
  }

  if (current.trim()) {
    chunks.push(current.trimEnd());
  }

  return chunks.length ? chunks : [content];
}

/**
 * Splits `content` into sub-fragment `RAGNode` records keyed to `parentId`.
 *
 * Each returned node:
 * - type: "fragment"
 * - id:   `${parentId}::frag::${index}`
 * - parentId: `parentId`
 * - title: `"${parentTitle} [${index + 1}/${total}]"`
 * - contentHash: SHA-256 of the chunk text (used for embedding dedup)
 * - chunkIndex / chunkTotal set for ordering
 *
 * Hashing runs in parallel via `Promise.all`.
 */
export async function chunkScene(
  parentId: string,
  parentTitle: string,
  content: string,
): Promise<RAGNode[]> {
  const texts = splitContent(content);
  const total = texts.length;

  const hashes = await Promise.all(texts.map((t) => hashFragment(t)));

  return texts.map((text, index) => ({
    ...createRAGNode(
      fragmentId(parentId, index),
      "fragment",
      `${parentTitle} [${index + 1}/${total}]`,
      text,
      parentId,
      hashes[index],
    ),
    tokenCount: estimateTokenCount(text),
    chunkIndex: index,
    chunkTotal: total,
  }));
}

/**
 * Returns the IDs of every sub-fragment that currently belongs to `parentId`,
 * given the stored `chunkTotal` on an existing sibling (or by scanning IDs).
 *
 * If `knownTotal` is provided (e.g. from the previous node record) this runs
 * in O(knownTotal) without any IDB query.
 *
 * Use this to delete stale fragments before writing new ones.
 */
export function staleFragmentIds(parentId: string, knownTotal: number): string[] {
  return Array.from({ length: knownTotal }, (_, i) => fragmentId(parentId, i));
}
