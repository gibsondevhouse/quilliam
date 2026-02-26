/**
 * RAG Hierarchy Types for Quilliam
 *
 * Quilliam organizes manuscripts as a 6-level recursive tree:
 * 1. Library (Root) — Global settings, user voice/style profiles
 * 2. Universe/Beat — High-level world rules or investigative themes
 * 3. Series/Investigation — Character arc continuity or multi-part reports
 * 4. Volume/Edition — Individual books or long-form publication drafts
 * 5. Chapter/Article — Active writing buffer (in-focus)
 * 6. Fragment (Leaf) — Semantic chunks (~500 tokens) for vectorization
 */

export type NodeType =
  | "library"
  | "book"
  | "part"
  | "chapter"
  | "scene";

export const NODE_TYPE_HIERARCHY: Record<NodeType, number> = {
  library: 0,
  book: 1,
  part: 2,
  chapter: 3,
  scene: 4,
};

export const VALID_CHILDREN: Record<NodeType, NodeType[]> = {
  library: ["book"],
  book: ["part", "chapter"],
  part: ["chapter"],
  chapter: ["scene"],
  scene: [],
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
 * Validate parent-child relationship
 */
export function isValidChild(parentType: NodeType, childType: NodeType): boolean {
  const validChildren = VALID_CHILDREN[parentType];
  return validChildren.includes(childType);
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
