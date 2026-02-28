/**
 * fenceParser.ts — parse and strip the `canonical_extraction` JSON fence
 * that the model emits when the chat route appends EXTRACTION_SUFFIX.
 *
 * The fence looks like:
 *
 *   ```canonical_extraction
 *   { "entities": [...], "relationships": [...] }
 *   ```
 *
 * This module is pure (no I/O) so it can run client-side without a round-trip.
 */

export interface RawExtractionEntity {
  type?: string;
  name?: string;
  summary?: string;
}

export interface RawExtractionRelationship {
  from?: string;
  relType?: string;
  to?: string;
}

export interface ExtractionFence {
  entities: RawExtractionEntity[];
  relationships: RawExtractionRelationship[];
}

const FENCE_RE =
  /```canonical_extraction\s*\n([\s\S]*?)\n?```/;

/**
 * Strips the canonical_extraction fence from `fullContent` and returns both
 * parts separately.  If no fence is found, `fence` is null and `prose` equals
 * the original input.
 */
export function extractFence(fullContent: string): {
  prose: string;
  fence: ExtractionFence | null;
} {
  const match = FENCE_RE.exec(fullContent);
  if (!match) {
    return { prose: fullContent, fence: null };
  }

  const raw = match[1].trim();
  const prose = fullContent.slice(0, match.index).trimEnd();

  try {
    const parsed = JSON.parse(raw) as Partial<ExtractionFence>;
    return {
      prose,
      fence: {
        entities: Array.isArray(parsed.entities) ? parsed.entities : [],
        relationships: Array.isArray(parsed.relationships) ? parsed.relationships : [],
      },
    };
  } catch {
    // Malformed JSON in fence — surface prose only, drop the fence safely.
    return { prose, fence: null };
  }
}
