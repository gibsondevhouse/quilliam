/**
 * RAG Hierarchy Types for Quilliam
 *
 * Quilliam organises manuscripts as a 7-level recursive tree:
 * 1. Library (Root) — Global settings, user voice/style profiles
 * 2. Series (optional) — Groups books in the same universe
 * 3. Book — Individual novels or long-form publication drafts
 * 4. Section — Named structural division within a book (renamed from "part")
 * 5. Chapter — Active writing buffer (in-focus)
 * 6. Scene — Writing unit linked to a canonical Scene doc
 * 7. Fragment (Leaf) — Semantic chunks (~500 tokens) for vectorisation; hidden in tree UI
 */

export type NodeType =
  | "library"
  | "series"
  | "book"
  /** Renamed from "part" — displayed as "Section" in the UI. */
  | "section"
  | "chapter"
  | "scene"
  /** Internal sub-fragment produced by chunking oversized scenes. Never shown in the UI tree. */
  | "fragment";

export const NODE_TYPE_HIERARCHY: Record<NodeType, number> = {
  library: 0,
  series: 1,
  book: 2,
  section: 3,
  chapter: 4,
  scene: 5,
  fragment: 6,
};

export const VALID_CHILDREN: Record<NodeType, NodeType[]> = {
  library: ["series", "book"],
  series: ["book"],
  book: ["section", "chapter"],
  section: ["chapter"],
  chapter: ["scene"],
  scene: ["fragment"],
  fragment: [],
};

/** Node types that are directly editable as documents */
export const EDITABLE_TYPES: NodeType[] = ["chapter", "scene"];

/**
 * Core RAG node structure using Parent-Pointer Graph
 */
export interface RAGNode {
  // Identity
  id: string; // UUID
  type: NodeType;

  // Hierarchy
  parentId: string | null; // null only for library (root)
  childrenIds: string[];

  // Content
  title: string;
  content: string; // Text content or metadata
  contentHash: string; // SHA-256 of fragment content (for cache invalidation)

  // Metadata
  createdAt: number; // Unix timestamp (ms)
  updatedAt: number; // Unix timestamp (ms)
  vectorEmbedding?: Float32Array; // Vector embedding for RAG (lazy-loaded)

  // Voice/Style (inherited from ancestors or explicitly set)
  voiceProfile?: string; // User's voice/tone instructions
  themeId?: string; // Associated theme ID

  // Fragment-specific
  tokenCount?: number; // Approximate token count (~500 target for fragments)
  semanticHash?: string; // Hash of semantic meaning (for deduplication)
  /** Set on "fragment" nodes produced by chunking an oversized scene. 0-based. */
  chunkIndex?: number;
  /** Total number of chunks the parent scene was split into. */
  chunkTotal?: number;
  /**
   * Set on "scene" nodes after Step C of the canonical migration.
   * Points to the `CanonicalDoc` id (e.g., `scn_...`) that holds the raw content,
   * so the tree UI can offer a quick-link badge to the canonical scene doc panel.
   */
  sceneDocId?: string;
}

/**
 * Create a new RAG node
 */
export function createRAGNode(
  id: string,
  type: NodeType,
  title: string,
  content: string,
  parentId: string | null = null,
  contentHash: string = ""
): RAGNode {
  const now = Date.now();

  return {
    id,
    type,
    title,
    content,
    contentHash,
    parentId,
    childrenIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Normalise legacy node types for backward compatibility.
 * Existing data stored before the rename can have type `'part'`; treat it as `'section'`.
 */
export function normalizeNodeType(type: string): NodeType {
  if (type === "part") return "section";
  return type as NodeType;
}

/**
 * Validate parent-child relationship.
 * Accepts raw strings so callers with legacy `'part'` nodes still work.
 */
export function isValidChild(parentType: string, childType: string): boolean {
  const normParent = normalizeNodeType(parentType);
  const normChild  = normalizeNodeType(childType);
  const validChildren = VALID_CHILDREN[normParent];
  return validChildren?.includes(normChild) ?? false;
}

/**
 * Get the ancestor hierarchy of a node (for context prefixing)
 */
export function getAncestryChain(
  nodeId: string,
  nodeMap: Map<string, RAGNode>
): RAGNode[] {
  const chain: RAGNode[] = [];
  let currentId: string | null = nodeId;

  while (currentId !== null) {
    const node = nodeMap.get(currentId);
    if (!node) break;

    chain.unshift(node); // Prepend to maintain top-down order
    currentId = node.parentId;
  }

  return chain;
}

/**
 * Get all descendants of a node (for recursive processing)
 */
export function getDescendants(
  nodeId: string,
  nodeMap: Map<string, RAGNode>
): RAGNode[] {
  const descendants: RAGNode[] = [];
  const queue: string[] = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const node = nodeMap.get(currentId);

    if (!node) continue;

    node.childrenIds.forEach((childId) => {
      const child = nodeMap.get(childId);
      if (child) {
        descendants.push(child);
        queue.push(childId);
      }
    });
  }

  return descendants;
}

/**
 * Fragment-specific: estimate token count (rough heuristic: 1 token ≈ 4 chars)
 */
export function estimateTokenCount(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Fragment-specific: check if fragment is at target size (~500 tokens)
 */
export const FRAGMENT_TARGET_TOKENS = 500;
export const FRAGMENT_TARGET_CHARS = FRAGMENT_TARGET_TOKENS * 4;

export function isFragmentAtTargetSize(fragment: RAGNode): boolean {
  const count = fragment.tokenCount ?? estimateTokenCount(fragment.content);
  return count >= FRAGMENT_TARGET_TOKENS;
}
