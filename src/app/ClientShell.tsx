"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { SystemStatus, type StartupStatus } from "@/components/SystemStatus";
import { AppNav } from "@/components/AppNav";
import { SystemContext } from "@/lib/context/SystemContext";
import { WorkspaceContext } from "@/lib/context/WorkspaceContext";
import type { NodeType } from "@/lib/rag/hierarchy";
import { EDITABLE_TYPES } from "@/lib/rag/hierarchy";
import { checkStorageHealth, createRAGStore, getCorpusStats } from "@/lib/rag/db";
import type { RAGStore } from "@/lib/rag/store";
import { findAncestorOfType, findLibraryIdForNode } from "@/lib/treeUtils";
import { useLibraryTree } from "@/lib/context/useLibraryTree";

/* ------------------------------------------------------------------
   ClientShell
   ------------------------------------------------------------------ */
export function ClientShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [systemStatus, setSystemStatus] = useState<StartupStatus | null>(null);
  // storeState is exposed via WorkspaceContext as `store` and drives useLibraryTree.
  const [storeState, setStoreState] = useState<RAGStore | null>(null);

  const {
    tree,
    ragNodes,
    addNode,
    renameNode,
    deleteNode,
    toggleExpand,
    moveNode,
    putRagNode,
    loadFromStore,
  } = useLibraryTree(storeState);

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

      if (!cancelled) {
        setStoreState(store);
      }
    };
    void setup();
    return () => { cancelled = true; };
  }, []);

  // Load the sidebar tree once the store is ready.
  useEffect(() => {
    if (storeState) void loadFromStore();
  }, [storeState, loadFromStore]);

  /* ---- Node selection: routes into library or chapter ---- */
  const handleNodeSelect = useCallback((id: string) => {
    const node = ragNodes[id];
    if (!node) return;
    if (node.type === "library") {
      localStorage.setItem("quilliam_last_library", id);
      router.push(`/library/${id}/universe`);
      return;
    }

    const libId = findLibraryIdForNode(ragNodes, id);
    if (!libId) return;
    localStorage.setItem("quilliam_last_library", libId);

    if (node.type === "book") {
      router.push(`/library/${libId}/books/${id}`);
      return;
    }

    if (node.type === "section") {
      const book = findAncestorOfType(ragNodes, id, "book");
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
  }, [router, ragNodes]);

  /* ---- Add child from tree ---- */
  const handleAddChild = useCallback((parentId: string | null, childType: NodeType) => {
    const newId = addNode(parentId, childType);
    if (childType === "library") {
      localStorage.setItem("quilliam_last_library", newId);
      router.push(`/library/${newId}/universe`);
    } else {
      // For other edit types, navigate into the library
      const libId = parentId
        ? findLibraryIdForNode(ragNodes, parentId) ?? parentId
        : null;
      if (!libId) return;

      if (childType === "book") {
        router.push(`/library/${libId}/books/${newId}`);
        return;
      }

      if (childType === "section") {
        const book = parentId ? findAncestorOfType(ragNodes, parentId, "book") : null;
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
  }, [addNode, router, ragNodes]);

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
      <WorkspaceContext.Provider value={{ store: storeState, tree, ragNodes, addNode, renameNode, deleteNode, toggleExpand, moveNode, putRagNode }}>
        <div className="ide-root">
          <div className="ide-body">
            {!pathname?.startsWith("/library/") && (
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
            )}
            <div className="ide-main">
              {children}
            </div>
          </div>
        </div>
      </WorkspaceContext.Provider>
    </SystemContext.Provider>
  );
}
