"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { SystemStatus, type StartupStatus } from "@/components/SystemStatus";
import { AppNav } from "@/components/AppNav";
import type { SidebarNode } from "@/lib/navigation";
import { SystemContext } from "@/lib/context/SystemContext";
import { RAGContext } from "@/lib/context/RAGContext";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import { EDITABLE_TYPES, createRAGNode, isValidChild } from "@/lib/rag/hierarchy";
import { createRAGStore } from "@/lib/rag/db";
import type { RAGStore } from "@/lib/rag/store";

/* ------------------------------------------------------------------
   Tree helpers (identical to those in original page.tsx)
   ------------------------------------------------------------------ */
function generateId() { return crypto.randomUUID(); }

const DEFAULT_TITLES: Record<NodeType, string> = {
  library: "Untitled Library",
  book: "Untitled Book",
  part: "Untitled Part",
  chapter: "Untitled Chapter",
  scene: "Untitled Scene",
  fragment: "Fragment",
};

function insertChild(nodes: SidebarNode[], parentId: string, child: SidebarNode): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === parentId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: insertChild(n.children, parentId, child) };
  });
}

function renameInTree(nodes: SidebarNode[], nodeId: string, newTitle: string): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, title: newTitle };
    return { ...n, children: renameInTree(n.children, nodeId, newTitle) };
  });
}

function deleteFromTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes.filter((n) => n.id !== nodeId).map((n) => ({ ...n, children: deleteFromTree(n.children, nodeId) }));
}

function findNode(nodes: SidebarNode[], id: string): SidebarNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findNode(n.children, id);
    if (found) return found;
  }
  return null;
}

function collectIds(node: SidebarNode): string[] {
  return [node.id, ...node.children.flatMap(collectIds)];
}

function toggleExpandInTree(nodes: SidebarNode[], nodeId: string): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === nodeId) return { ...n, isExpanded: !n.isExpanded };
    return { ...n, children: toggleExpandInTree(n.children, nodeId) };
  });
}

function removeFromTree(nodes: SidebarNode[], nodeId: string): { remaining: SidebarNode[]; removed: SidebarNode | null } {
  let removed: SidebarNode | null = null;
  const remaining = nodes.filter((n) => {
    if (n.id === nodeId) { removed = n; return false; }
    return true;
  }).map((n) => {
    if (removed) return n;
    const result = removeFromTree(n.children, nodeId);
    if (result.removed) removed = result.removed;
    return { ...n, children: result.remaining };
  });
  return { remaining, removed };
}

function addChildToNode(nodes: SidebarNode[], targetId: string, child: SidebarNode): SidebarNode[] {
  return nodes.map((n) => {
    if (n.id === targetId) return { ...n, children: [...n.children, child], isExpanded: true };
    return { ...n, children: addChildToNode(n.children, targetId, child) };
  });
}

function buildSidebarTreeFromRAG(nodes: RAGNode[]): SidebarNode[] {
  const map = new Map<string, SidebarNode>();
  nodes.forEach((node) => {
    map.set(node.id, { id: node.id, title: node.title, type: node.type, children: [], isExpanded: true });
  });
  const roots: SidebarNode[] = [];
  nodes.forEach((node) => {
    const sn = map.get(node.id)!;
    if (node.parentId === null) {
      roots.push(sn);
    } else {
      const parent = map.get(node.parentId);
      if (parent) parent.children.push(sn);
    }
  });
  return roots;
}

function rebuildRagNodesFromTree(
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

/** Traverse the tree upward to find the nearest ancestor of type 'library'. */
function findLibraryIdForNode(ragNodes: Record<string, RAGNode>, nodeId: string): string | null {
  let current = ragNodes[nodeId];
  while (current) {
    if (current.type === "library") return current.id;
    if (current.parentId === null) return null;
    current = ragNodes[current.parentId];
  }
  return null;
}

function containsNode(nodes: SidebarNode[], nodeId: string): boolean {
  return findNode(nodes, nodeId) !== null;
}

function findAncestorOfType(
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

function isDescendantNode(
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

/* ------------------------------------------------------------------
   ClientShell
   ------------------------------------------------------------------ */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [systemStatus, setSystemStatus] = useState<StartupStatus | null>(null);
  const [tree, setTree] = useState<SidebarNode[]>([]);
  const [ragNodes, setRagNodes] = useState<Record<string, RAGNode>>({});
  const [storeReady, setStoreReady] = useState(false);

  const storeRef = useRef<RAGStore | null>(null);
  const treeRef = useRef(tree);
  const ragNodesRef = useRef(ragNodes);

  useEffect(() => { treeRef.current = tree; }, [tree]);
  useEffect(() => { ragNodesRef.current = ragNodes; }, [ragNodes]);

  const handleReady = useCallback((status: StartupStatus) => {
    setSystemStatus(status);
  }, []);

  /* ---- Store initialization (runs once after system ready) ---- */
  useEffect(() => {
    let cancelled = false;
    const setup = async () => {
      const store = await createRAGStore();
      if (cancelled) return;
      storeRef.current = store;

      const storedNodes = await store.listAllNodes();
      if (!cancelled && storedNodes.length > 0) {
        const nodesMap = storedNodes.reduce<Record<string, RAGNode>>((acc, n) => { acc[n.id] = n; return acc; }, {});
        setRagNodes(nodesMap);
        setTree(buildSidebarTreeFromRAG(storedNodes));
      }
      setStoreReady(true);
    };
    void setup();
    return () => { cancelled = true; };
  }, []);

  /* ---- Tree operations (exposed via RAGContext) ---- */

  const persistRagMap = useCallback((next: Record<string, RAGNode>) => {
    const store = storeRef.current;
    if (!store) return;
    Object.values(next).forEach((node) => {
      void store.putNode(node);
    });
  }, []);

  const addNode = useCallback((parentId: string | null, type: NodeType): string => {
    const id = generateId();
    const newSidebarNode: SidebarNode = { id, title: DEFAULT_TITLES[type], type, children: [], isExpanded: true };
    if (parentId === null) {
      setTree((prev) => [...prev, newSidebarNode]);
    } else {
      setTree((prev) => insertChild(prev, parentId, newSidebarNode));
    }
    const parent = parentId ? ragNodesRef.current[parentId] : null;
    const ragNode = createRAGNode(id, type, DEFAULT_TITLES[type], "", parentId);
    setRagNodes((prev) => {
      const next = { ...prev, [id]: ragNode };
      if (parentId && prev[parentId]) {
        next[parentId] = { ...prev[parentId], childrenIds: [...prev[parentId].childrenIds, id] };
      }
      return next;
    });
    void storeRef.current?.putNode(ragNode);
    if (parent && ragNodesRef.current[parent.id]) {
      const updatedParent = { ...ragNodesRef.current[parent.id], childrenIds: [...ragNodesRef.current[parent.id].childrenIds, id], updatedAt: Date.now() };
      void storeRef.current?.putNode(updatedParent);
    }

    // Book nodes back Story entities. Ensure direct tree-created books stay routable.
    if (type === "book") {
      const source = parentId ? ragNodesRef.current[parentId] : null;
      const libraryId = source?.type === "library"
        ? source.id
        : (parentId ? findLibraryIdForNode(ragNodesRef.current, parentId) : null);
      if (libraryId) {
        const now = Date.now();
        void storeRef.current?.putStory({
          id,
          libraryId,
          title: DEFAULT_TITLES.book,
          synopsis: "",
          genre: "",
          status: "drafting",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    return id;
  }, []);

  const renameNode = useCallback((id: string, title: string) => {
    setTree((prev) => renameInTree(prev, id, title));
    setRagNodes((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const updated = { ...existing, title, updatedAt: Date.now() };
      void storeRef.current?.putNode(updated);
      if (updated.type === "book") {
        const now = Date.now();
        const libraryId = findLibraryIdForNode(prev, id);
        if (libraryId) {
          void storeRef.current?.getStory(id).then((story) => {
            const nextStory = story ?? {
              id,
              libraryId,
              title,
              synopsis: "",
              genre: "",
              status: "drafting" as const,
              createdAt: now,
              updatedAt: now,
            };
            void storeRef.current?.putStory({ ...nextStory, title, updatedAt: Date.now() });
          });
        }
      }
      return { ...prev, [id]: updated };
    });
  }, []);

  const deleteNode = useCallback((id: string) => {
    setTree((prevTree) => {
      const removedNode = findNode(prevTree, id);
      if (!removedNode) return prevTree;

      const removedIds = new Set(collectIds(removedNode));
      const nextTree = deleteFromTree(prevTree, id);
      const removedRoot = ragNodesRef.current[id];

      setRagNodes((current) => {
        const rebuilt = rebuildRagNodesFromTree(nextTree, current);
        persistRagMap(rebuilt);
        return rebuilt;
      });

      if (removedRoot?.type === "library") {
        void storeRef.current?.deleteLibraryCascade(id);
      } else if (removedRoot?.type === "book") {
        void storeRef.current?.deleteStoryCascade(id);
      } else {
        removedIds.forEach((rid) => {
          void storeRef.current?.deleteNode(rid);
        });
      }

      return nextTree;
    });
  }, [persistRagMap]);

  const toggleExpand = useCallback((id: string) => {
    setTree((prev) => toggleExpandInTree(prev, id));
  }, []);

  const moveNode = useCallback((dragId: string, targetId: string) => {
    setTree((prev) => {
      const dragNode = ragNodesRef.current[dragId];
      const targetNode = ragNodesRef.current[targetId];
      if (!dragNode || !targetNode) return prev;
      if (!isValidChild(targetNode.type, dragNode.type)) return prev;
      if (isDescendantNode(ragNodesRef.current, dragId, targetId)) return prev;

      const { remaining, removed } = removeFromTree(prev, dragId);
      if (!removed) return prev;
      const nextTree = addChildToNode(remaining, targetId, removed);
      if (!containsNode(nextTree, dragId)) return prev;

      setRagNodes((current) => {
        const rebuilt = rebuildRagNodesFromTree(nextTree, current);
        persistRagMap(rebuilt);
        return rebuilt;
      });
      return nextTree;
    });
  }, [persistRagMap]);

  const putRagNode = useCallback((node: RAGNode) => {
    setRagNodes((prev) => ({ ...prev, [node.id]: node }));
    void storeRef.current?.putNode(node);
  }, []);

  /* ---- Node selection: routes into library or chapter ---- */
  const handleNodeSelect = useCallback((id: string) => {
    const node = ragNodesRef.current[id];
    if (!node) return;
    if (node.type === "library") {
      localStorage.setItem("quilliam_last_library", id);
      router.push(`/library/${id}/dashboard`);
      return;
    }

    const libId = findLibraryIdForNode(ragNodesRef.current, id);
    if (!libId) return;
    localStorage.setItem("quilliam_last_library", libId);

    if (node.type === "book") {
      router.push(`/library/${libId}/stories/${id}`);
      return;
    }

    if (node.type === "part") {
      const book = findAncestorOfType(ragNodesRef.current, id, "book");
      if (book) {
        router.push(`/library/${libId}/stories/${book.id}/chapters`);
      } else {
        router.push(`/library/${libId}/chapters`);
      }
      return;
    }

    if ((EDITABLE_TYPES as string[]).includes(node.type)) {
      router.push(`/library/${libId}/chapters/${id}`);
    }
  }, [router]);

  /* ---- Add child from tree ---- */
  const handleAddChild = useCallback((parentId: string | null, childType: NodeType) => {
    const newId = addNode(parentId, childType);
    if (childType === "library") {
      localStorage.setItem("quilliam_last_library", newId);
      router.push(`/library/${newId}/dashboard`);
    } else {
      // For other edit types, navigate into the library
      const libId = parentId
        ? findLibraryIdForNode(ragNodesRef.current, parentId) ?? parentId
        : null;
      if (!libId) return;

      if (childType === "book") {
        router.push(`/library/${libId}/stories/${newId}`);
        return;
      }

      if (childType === "part") {
        const book = parentId ? findAncestorOfType(ragNodesRef.current, parentId, "book") : null;
        if (book) {
          router.push(`/library/${libId}/stories/${book.id}/chapters`);
        } else {
          router.push(`/library/${libId}/chapters`);
        }
        return;
      }

      if ((EDITABLE_TYPES as string[]).includes(childType)) {
        router.push(`/library/${libId}/chapters/${newId}`);
      }
    }
  }, [addNode, router]);

  /* ---- Derive current library from pathname for sidebar highlighting ---- */
  const activeLibraryId = useMemo(() => {
    const match = pathname?.match(/^\/library\/([^/]+)/);
    return match ? match[1] : null;
  }, [pathname]);

  /* ---- dirtyIds: ClientShell doesn't track dirty content (that's LibraryLayout) ---- */
  const dirtyIds = useMemo(() => new Set<string>(), []);

  if (!systemStatus) {
    return (
      <div className="ide-startup">
        <SystemStatus onReady={handleReady} />
      </div>
    );
  }

  return (
    <SystemContext.Provider value={{ status: systemStatus }}>
      <RAGContext.Provider value={{ storeRef, storeReady, tree, ragNodes, addNode, renameNode, deleteNode, toggleExpand, moveNode, putRagNode }}>
        <div className="ide-root">
          <div className="ide-body">
            <AppNav
              tree={tree}
              ragNodes={ragNodes}
              activeNodeId={activeLibraryId}
              onNodeSelect={handleNodeSelect}
              onAddChild={handleAddChild}
              onRenameNode={renameNode}
              onDeleteNode={deleteNode}
              onToggleExpand={toggleExpand}
              onMoveNode={moveNode}
              dirtyIds={dirtyIds}
              pathname={pathname}
            />
            <div className="ide-main">
              {children}
            </div>
          </div>
        </div>
      </RAGContext.Provider>
    </SystemContext.Provider>
  );
}
