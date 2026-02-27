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
import { cosineSimilarity } from "./search";

/** Multiplier above target at which we bother splitting (avoids micro-chunks). */
export const CHUNK_SPLIT_THRESHOLD = 1.5;

/**
 * Bumped whenever the chunking algorithm changes in a way that invalidates
 * existing embeddings. The DB migration checks this via the stored metadata
 * key `chunkStrategyVersion` and triggers a re-index when it differs.
 */
export const CHUNK_STRATEGY_VERSION = "v2";

/**
 * Minimum cosine similarity between consecutive sentences to keep them in
 * the same chunk. Below this value a semantic boundary is detected and a
 * new chunk is started.
 */
const SEMANTIC_BOUNDARY_THRESHOLD = 0.8;

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
 * Fallback: split on blank-line paragraph boundaries, 200-char overlap.
 * Used when no `embedFn` is supplied to `chunkScene`.
 */
function paragraphSplitContent(content: string): string[] {
  const targetChars = FRAGMENT_TARGET_TOKENS * 4;
  const overlapChars = 200;

  const paragraphs = content.split(/(\n\n+)/);
  const chunks: string[] = [];
  let current = "";

  for (const segment of paragraphs) {
    if (current.length + segment.length > targetChars && current.trim()) {
      chunks.push(current.trimEnd());
      const overlap = current.length > overlapChars ? current.slice(-overlapChars) : current;
      current = overlap + segment;
    } else {
      current += segment;
    }
  }
  if (current.trim()) chunks.push(current.trimEnd());
  return chunks.length ? chunks : [content];
}

/**
 * Splits prose text into individual sentences on `.`, `!`, `?` boundaries.
 * Consecutive short fragments (< 4 words) are merged into the previous
 * sentence to avoid micro-embeddings from e.g. "Mr." or dialogue beats.
 */
export function splitSentences(text: string): string[] {
  const raw = text
    .split(/(?<=[.!?]["']?)\s+(?=[A-Z"])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const merged: string[] = [];
  for (const s of raw) {
    const wordCount = s.split(/\s+/).length;
    if (merged.length > 0 && wordCount < 4) {
      merged[merged.length - 1] += " " + s;
    } else {
      merged.push(s);
    }
  }
  return merged.length ? merged : [text];
}

/**
 * Adaptive semantic chunking.
 *
 * Grows each chunk sentence-by-sentence; starts a new chunk when:
 * - The cosine similarity between the current sentence and its predecessor
 *   drops below `SEMANTIC_BOUNDARY_THRESHOLD` (0.80) — topic shift detected.
 * - OR the running token count would exceed `FRAGMENT_TARGET_TOKENS` (~500).
 *
 * Each new chunk prepends the last sentence of the previous chunk as a
 * 1-sentence overlap to preserve narrative continuity.
 *
 * The chunking step embeds every sentence individually, making it ~3–5×
 * slower than paragraph splitting — acceptable for background indexing.
 *
 * @param content  Raw prose text to split.
 * @param embedFn  Async function that returns a Float32Array embedding for a string.
 */
async function semanticSplitContent(
  content: string,
  embedFn: (text: string) => Promise<Float32Array>,
): Promise<string[]> {
  const sentences = splitSentences(content);
  if (sentences.length <= 1) return [content];

  const targetTokens = FRAGMENT_TARGET_TOKENS;

  // Embed all sentences in parallel (Ollama serialises internally)
  const embeddings = await Promise.all(sentences.map((s) => embedFn(s)));

  const chunks: string[] = [];
  let currentSentences: string[] = [sentences[0]];
  let currentTokens = estimateTokenCount(sentences[0]);
  let prevEmbedding = embeddings[0];

  for (let i = 1; i < sentences.length; i++) {
    const s = sentences[i];
    const sTokens = estimateTokenCount(s);
    const sim = cosineSimilarity(prevEmbedding, embeddings[i]);

    const tokenOverflow = currentTokens + sTokens > targetTokens;
    const semanticBreak = sim < SEMANTIC_BOUNDARY_THRESHOLD;

    if (tokenOverflow || semanticBreak) {
      chunks.push(currentSentences.join(" "));
      // 1-sentence overlap for continuity
      const overlapSentence = currentSentences[currentSentences.length - 1];
      currentSentences = [overlapSentence, s];
      currentTokens = estimateTokenCount(overlapSentence) + sTokens;
    } else {
      currentSentences.push(s);
      currentTokens += sTokens;
    }
    prevEmbedding = embeddings[i];
  }

  if (currentSentences.length > 0) {
    chunks.push(currentSentences.join(" "));
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
  embedFn?: (text: string) => Promise<Float32Array>,
): Promise<RAGNode[]> {
  const texts = embedFn
    ? await semanticSplitContent(content, embedFn)
    : paragraphSplitContent(content);
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
