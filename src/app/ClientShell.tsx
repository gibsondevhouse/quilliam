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
import { checkStorageHealth, createRAGStore, getCorpusStats } from "@/lib/rag/db";
import type { RAGStore } from "@/lib/rag/store";
import {
  addChildToNode,
  buildSidebarTreeFromRAG,
  collectIds,
  containsNode,
  DEFAULT_TITLES,
  deleteFromTree,
  findAncestorOfType,
  findLibraryIdForNode,
  findNode,
  generateId,
  insertChild,
  isDescendantNode,
  rebuildRagNodesFromTree,
  removeFromTree,
  renameInTree,
  toggleExpandInTree,
} from "@/lib/treeUtils";

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
      // Request persistent storage so the browser doesn't evict IDB under
      // quota pressure. Safari private-browsing always denies this; Chrome
      // and Firefox honour it. A denial is non-fatal — log and continue.
      if (navigator.storage?.persist) {
        const persisted = await navigator.storage.persist();
        if (!persisted) {
          console.warn(
            "Quilliam: persistent storage not granted — IndexedDB may be evicted under quota pressure.",
          );
        }
      }

      const store = await createRAGStore();
      if (cancelled) return;
      storeRef.current = store;

      // Detect Safari private-browsing zero-quota (navigator.storage.estimate()
      // is silently broken on Safari, so we probe with a real write instead).
      const storageHealth = await checkStorageHealth();
      if (storageHealth === "privateMode") {
        console.warn(
          "Quilliam: IndexedDB is in private-browsing mode — quota is zero. " +
          "RAG indexing and chat history will not persist across page loads.",
        );
      } else if (storageHealth === "unavailable") {
        console.warn("Quilliam: IndexedDB is unavailable in this environment.");
      }

      const storedNodes = await store.listAllNodes();
      if (!cancelled && storedNodes.length > 0) {
        const nodesMap = storedNodes.reduce<Record<string, RAGNode>>((acc, n) => { acc[n.id] = n; return acc; }, {});
        setRagNodes(nodesMap);
        setTree(buildSidebarTreeFromRAG(storedNodes));
      }
      // Log corpus stats in dev; warn when approaching Safari's ~10k-record
      // performance cliff (see run001 phase 3 research).
      if (process.env.NODE_ENV !== "production") {
        const stats = await getCorpusStats();
        if (stats.nearPerformanceCliff) {
          console.warn(
            `Quilliam: corpus is approaching the IndexedDB performance cliff ` +
            `(${stats.fragmentCount} fragments + ${stats.embeddingCount} embeddings). ` +
            "Consider pruning old libraries or planning an OPFS migration.",
          );
        } else {
          console.debug("Quilliam: corpus stats", stats);
        }
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
      router.push(`/library/${id}/universe`);
      return;
    }

    const libId = findLibraryIdForNode(ragNodesRef.current, id);
    if (!libId) return;
    localStorage.setItem("quilliam_last_library", libId);

    if (node.type === "book") {
      router.push(`/library/${libId}/books/${id}`);
      return;
    }

    if (node.type === "section") {
      const book = findAncestorOfType(ragNodesRef.current, id, "book");
      if (book) {
        router.push(`/library/${libId}/books/${book.id}/chapters`);
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
      router.push(`/library/${newId}/universe`);
    } else {
      // For other edit types, navigate into the library
      const libId = parentId
        ? findLibraryIdForNode(ragNodesRef.current, parentId) ?? parentId
        : null;
      if (!libId) return;

      if (childType === "book") {
        router.push(`/library/${libId}/books/${newId}`);
        return;
      }

      if (childType === "section") {
        const book = parentId ? findAncestorOfType(ragNodesRef.current, parentId, "book") : null;
        if (book) {
          router.push(`/library/${libId}/books/${book.id}/chapters`);
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
              libraryId={activeLibraryId}
              activeNodeId={activeLibraryId}
              onNodeSelect={handleNodeSelect}
              onAddChild={handleAddChild}
              onRenameNode={renameNode}
              onDeleteNode={deleteNode}
              onToggleExpand={toggleExpand}
              onMoveNode={moveNode}
              dirtyIds={dirtyIds}
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
