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
import { ActivityBar } from "@/components/Editor/ActivityBar";
import { Sidebar, type SidebarNode, type SidebarTab } from "@/components/Editor/Sidebar";
import { SystemContext } from "@/lib/context/SystemContext";
import { RAGContext } from "@/lib/context/RAGContext";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import { EDITABLE_TYPES, createRAGNode } from "@/lib/rag/hierarchy";
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

function findParentId(nodes: SidebarNode[], id: string, parentId: string | null = null): string | null {
  for (const node of nodes) {
    if (node.id === id) return parentId;
    const found = findParentId(node.children, id, node.id);
    if (found !== null) return found;
  }
  return null;
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

/* ------------------------------------------------------------------
   ClientShell
   ------------------------------------------------------------------ */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [systemStatus, setSystemStatus] = useState<StartupStatus | null>(null);
  const [activePanel, setActivePanel] = useState<SidebarTab>("manuscripts");
  const [sidebarVisible, setSidebarVisible] = useState(true);
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
    // Persist last-used library so we can redirect on next load
    const lastLibId = localStorage.getItem("quilliam_last_library");
    if (lastLibId) {
      router.replace(`/library/${lastLibId}/dashboard`);
    }
  }, [router]);

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

  /* ---- Handle navigator panel toggle ---- */
  const handlePanelChange = useCallback((panel: SidebarTab) => {
    if (panel === activePanel && sidebarVisible) {
      setSidebarVisible(false);
    } else {
      setActivePanel(panel);
      setSidebarVisible(true);
    }
  }, [activePanel, sidebarVisible]);

  /* ---- Tree operations (exposed via RAGContext) ---- */

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
    return id;
  }, []);

  const renameNode = useCallback((id: string, title: string) => {
    setTree((prev) => renameInTree(prev, id, title));
    setRagNodes((prev) => {
      const existing = prev[id];
      if (!existing) return prev;
      const updated = { ...existing, title, updatedAt: Date.now() };
      void storeRef.current?.putNode(updated);
      return { ...prev, [id]: updated };
    });
  }, []);

  const deleteNode = useCallback((id: string) => {
    const node = findNode(treeRef.current, id);
    if (node) {
      const ids = new Set(collectIds(node));
      setRagNodes((prev) => {
        const next = { ...prev };
        ids.forEach((rid) => { delete next[rid]; void storeRef.current?.deleteNode(rid); });
        return next;
      });
    }
    setTree((prev) => deleteFromTree(prev, id));
  }, []);

  const toggleExpand = useCallback((id: string) => {
    setTree((prev) => toggleExpandInTree(prev, id));
  }, []);

  const moveNode = useCallback((dragId: string, targetId: string) => {
    setTree((prev) => {
      const { remaining, removed } = removeFromTree(prev, dragId);
      if (!removed) return prev;
      const nextTree = addChildToNode(remaining, targetId, removed);
      setRagNodes((current) => rebuildRagNodesFromTree(nextTree, current));
      return nextTree;
    });
  }, []);

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
    // For chapter/scene nodes, find their parent library and navigate
    if ((EDITABLE_TYPES as string[]).includes(node.type)) {
      const libId = findLibraryIdForNode(ragNodesRef.current, id);
      if (libId) {
        localStorage.setItem("quilliam_last_library", libId);
        router.push(`/library/${libId}/chapters/${id}`);
      }
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
      if (libId && (EDITABLE_TYPES as string[]).includes(childType)) {
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
            <ActivityBar
              activePanel={sidebarVisible ? activePanel : null}
              onPanelChange={handlePanelChange}
            />
            {sidebarVisible && (
              <Sidebar
                activePanel={activePanel}
                tree={tree}
                activeNodeId={activeLibraryId}
                onNodeSelect={handleNodeSelect}
                onAddChild={handleAddChild}
                onRenameNode={renameNode}
                onDeleteNode={deleteNode}
                onToggleExpand={toggleExpand}
                onMoveNode={moveNode}
                dirtyIds={dirtyIds}
                /* Legacy per-panel props — no longer rendered in global sidebar */
                chats={[]}
                activeChatId={null}
                onSelectChat={() => {}}
                onNewChat={() => {}}
                onDeleteChat={() => {}}
                characters={[]}
                activeCharacterId={null}
                onSelectCharacter={() => {}}
                onAddCharacter={() => {}}
                onDeleteCharacter={() => {}}
                locations={[]}
                activeLocationId={null}
                onSelectLocation={() => {}}
                onAddLocation={() => {}}
                onDeleteLocation={() => {}}
                worldEntries={[]}
                activeWorldEntryId={null}
                onSelectWorldEntry={() => {}}
                onAddWorldEntry={() => {}}
                onDeleteWorldEntry={() => {}}
                outlineHeadings={[]}
                outlineDocumentTitle={null}
                onOutlineJumpTo={() => {}}
              />
            )}
            <div className="ide-main">
              {children}
            </div>
          </div>
        </div>
      </RAGContext.Provider>
    </SystemContext.Provider>
  );
}
