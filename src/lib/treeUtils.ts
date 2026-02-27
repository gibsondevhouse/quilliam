import type { SidebarNode } from "@/lib/navigation";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";

export function generateId() {
  return crypto.randomUUID();
}

export const DEFAULT_TITLES: Record<NodeType, string> = {
  library: "Untitled Library",
  book: "Untitled Book",
  part: "Untitled Part",
  chapter: "Untitled Chapter",
  scene: "Untitled Scene",
  fragment: "Fragment",
};

export function insertChild(
  nodes: SidebarNode[],
  parentId: string,
  child: SidebarNode,
): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: insertChild(n.children, parentId, child) };
  });
}

export function renameInTree(
  nodes: SidebarNode[],
  nodeId: string,
  newTitle: string,
): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, title: newTitle };
    return { ...n, children: renameInTree(n.children, nodeId, newTitle) };
  });
}

export function deleteFromTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => ({ ...n, children: deleteFromTree(n.children, nodeId) }));
}

export function findNode(nodes: SidebarNode[], id: string): SidebarNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

export function collectIds(node: SidebarNode): string[] {
  return [node.id, ...node.children.flatMap(collectIds)];
}

export function toggleExpandInTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, isExpanded: !n.isExpanded };
    return { ...n, children: toggleExpandInTree(n.children, nodeId) };
  });
}

export function removeFromTree(
  nodes: SidebarNode[],
  nodeId: string,
): { remaining: SidebarNode[]; removed: SidebarNode | null } {
  let removed: SidebarNode | null = null;
  const remaining = nodes
    .filter((n) => {
      if (n.id === nodeId) {
        removed = n;
        return false;
      }
      return true;
    })
    .map((n) => {
      if (removed) return n;
      const result = removeFromTree(n.children, nodeId);
      if (result.removed) removed = result.removed;
      return { ...n, children: result.remaining };
    });
  return { remaining, removed };
}

export function addChildToNode(
  nodes: SidebarNode[],
  targetId: string,
  child: SidebarNode,
): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: addChildToNode(n.children, targetId, child) };
  });
}

export function buildSidebarTreeFromRAG(nodes: RAGNode[]): SidebarNode[] {
  const map = new Map<string, SidebarNode>();
  nodes.forEach((node) => {
    map.set(node.id, {
      id: node.id,
      title: node.title,
      type: node.type,
      children: [],
      isExpanded: true,
    });
  });
  const roots: SidebarNode[] = [];
  nodes.forEach((node) => {
    const sidebarNode = map.get(node.id);
    if (!sidebarNode) return;
    if (node.parentId === null) {
      roots.push(sidebarNode);
    } else {
      const parent = map.get(node.parentId);
      if (parent) parent.children.push(sidebarNode);
    }
  });
  return roots;
}

export function rebuildRagNodesFromTree(
  nodes: SidebarNode[],
  existing: Record<string, RAGNode>,
): Record<string, RAGNode> {
  const next: Record<string, RAGNode> = {};
  const walk = (list: SidebarNode[], parentId: string | null) => {
    list.forEach((node) => {
      const current = existing[node.id];
      const createdAt = current?.createdAt ?? Date.now();
      next[node.id] = {
        id: node.id,
        type: node.type,
        title: current?.title ?? node.title,
        content: current?.content ?? "",
        contentHash: current?.contentHash ?? "",
        parentId,
        childrenIds: node.children.map((c) => c.id),
        createdAt,
        updatedAt: current?.updatedAt ?? createdAt,
        vectorEmbedding: current?.vectorEmbedding,
        voiceProfile: current?.voiceProfile,
        themeId: current?.themeId,
        tokenCount: current?.tokenCount,
        semanticHash: current?.semanticHash,
      };
      if (node.children.length > 0) walk(node.children, node.id);
    });
  };
  walk(nodes, null);
  return next;
}

export function findLibraryIdForNode(
  ragNodes: Record<string, RAGNode>,
  nodeId: string,
): string | null {
  let current = ragNodes[nodeId];
  while (current) {
    if (current.type === "library") return current.id;
    if (current.parentId === null) return null;
    current = ragNodes[current.parentId];
  }
  return null;
}

export function containsNode(nodes: SidebarNode[], nodeId: string): boolean {
  return findNode(nodes, nodeId) !== null;
}

export function findAncestorOfType(
  ragNodes: Record<string, RAGNode>,
  nodeId: string,
  targetType: NodeType,
): RAGNode | null {
  let current = ragNodes[nodeId];
  while (current) {
    if (current.type === targetType) return current;
    if (!current.parentId) return null;
    current = ragNodes[current.parentId];
  }
  return null;
}

export function isDescendantNode(
  ragNodes: Record<string, RAGNode>,
  ancestorId: string,
  candidateId: string,
): boolean {
  let current = ragNodes[candidateId];
  while (current) {
    if (current.parentId === ancestorId) return true;
    if (!current.parentId) return false;
    current = ragNodes[current.parentId];
  }
  return false;
}
