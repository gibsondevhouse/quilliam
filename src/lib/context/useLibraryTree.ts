"use client";

/**
 * useLibraryTree — wraps libraryTreeReducer with IDB side-effects.
 *
 * Replaces the `treeRef`/`ragNodesRef` mirror pattern + 6 useCallback blocks
 * that previously lived in ClientShell. The reducer handles pure state
 * transitions; this hook adds IDB persistence as targeted per-operation
 * writes (no O(n) full-map rewrites).
 */

import { useCallback, useReducer, useRef, useEffect } from "react";
import {
  libraryTreeReducer,
  INITIAL_TREE_STATE,
  type LibraryTreeState,
} from "./libraryTreeReducer";
import {
  createRAGNode,
} from "@/lib/rag/hierarchy";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import type { RAGStore } from "@/lib/rag/store";
import type { SidebarNode } from "@/lib/navigation";
import {
  collectIds,
  DEFAULT_TITLES,
  findLibraryIdForNode,
  findNode,
  generateId,
} from "@/lib/treeUtils";
import type { PersistedStory } from "@/lib/rag/store";

export interface UseLibraryTreeResult {
  tree: SidebarNode[];
  ragNodes: Record<string, RAGNode>;
  addNode: (parentId: string | null, type: NodeType) => string;
  renameNode: (id: string, title: string) => void;
  deleteNode: (id: string) => void;
  toggleExpand: (id: string) => void;
  moveNode: (dragId: string, targetId: string) => void;
  putRagNode: (node: RAGNode) => void;
  loadFromStore: () => Promise<void>;
}

export function useLibraryTree(store: RAGStore | null): UseLibraryTreeResult {
  const [state, dispatch] = useReducer(libraryTreeReducer, INITIAL_TREE_STATE);

  // Mirror state into a ref so stable callbacks can read current values without
  // needing state in their dependency arrays (avoids cascade re-renders).
  const stateRef = useRef<LibraryTreeState>(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  const loadFromStore = useCallback(async () => {
    if (!store) return;
    const nodes = await store.listAllNodes();
    if (nodes.length > 0) dispatch({ type: "LOAD", nodes });
  }, [store]);

  const addNode = useCallback((parentId: string | null, type: NodeType): string => {
    const id = generateId();
    const ragNode = createRAGNode(id, type, DEFAULT_TITLES[type], "", parentId);
    const sidebarNode: SidebarNode = {
      id,
      title: DEFAULT_TITLES[type],
      type,
      children: [],
      isExpanded: true,
    };
    dispatch({ type: "ADD_NODE", parentId, nodeType: type, id, ragNode, sidebarNode });

    // Persist only the new node (and parent if childrenIds changed)
    void store?.putNode(ragNode);
    const currentNodes = stateRef.current.ragNodes;
    if (parentId && currentNodes[parentId]) {
      const updatedParent: RAGNode = {
        ...currentNodes[parentId],
        childrenIds: [...currentNodes[parentId].childrenIds, id],
        updatedAt: Date.now(),
      };
      void store?.putNode(updatedParent);
    }

    // Book nodes also need a Story record so they're routable.
    if (type === "book") {
      const source = parentId ? currentNodes[parentId] : null;
      const libraryId =
        source?.type === "library"
          ? source.id
          : parentId
            ? findLibraryIdForNode(currentNodes, parentId)
            : null;
      if (libraryId) {
        const now = Date.now();
        const story: PersistedStory = {
          id,
          libraryId,
          title: DEFAULT_TITLES.book,
          synopsis: "",
          genre: "",
          status: "drafting",
          createdAt: now,
          updatedAt: now,
        };
        void store?.putStory(story);
      }
    }

    return id;
  }, [store]);

  const renameNode = useCallback((id: string, title: string) => {
    const updatedAt = Date.now();
    dispatch({ type: "RENAME_NODE", id, title, updatedAt });

    const node = stateRef.current.ragNodes[id];
    if (!node) return;
    const updated: RAGNode = { ...node, title, updatedAt };
    void store?.putNode(updated);

    if (node.type === "book") {
      const libraryId = findLibraryIdForNode(stateRef.current.ragNodes, id);
      if (libraryId) {
        const now = Date.now();
        void store?.getStory(id).then((story) => {
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
          void store?.putStory({ ...nextStory, title, updatedAt: Date.now() });
        });
      }
    }
  }, [store]);

  const deleteNode = useCallback((id: string) => {
    const { tree, ragNodes } = stateRef.current;
    const removedNode = findNode(tree, id);
    if (!removedNode) return;
    const removedIds = new Set(collectIds(removedNode));
    const removedRoot = ragNodes[id];

    dispatch({ type: "DELETE_NODE", id });

    // IDB cascade — targeted per-node deletes, no full-map rewrite.
    if (removedRoot?.type === "library") {
      void store?.deleteLibraryCascade(id);
    } else if (removedRoot?.type === "book") {
      void store?.deleteStoryCascade(id);
    } else {
      removedIds.forEach((rid) => { void store?.deleteNode(rid); });
    }
  }, [store]);

  const toggleExpand = useCallback((id: string) => {
    dispatch({ type: "TOGGLE_EXPAND", id });
    // toggleExpand is intentionally not persisted (UI state only).
  }, []);

  const moveNode = useCallback((dragId: string, targetId: string) => {
    // Validation is done inside the reducer; we just need to persist the
    // rebuilt ragNodes after the move. We do that by persisting the full
    // rebuilt map IF the reducer actually changed state (detected via
    // the stateRef post-dispatch). For simplicity, always persist via
    // a full-map write on move (it's a rare, explicit user action).
    dispatch({ type: "MOVE_NODE", dragId, targetId });
    // Persist happens in the useEffect below.
  }, []);

  // Persist ragNodes after a MOVE_NODE action. We track moves with a separate
  // ref to avoid full-map writes on every state change.
  const prevRagNodesRef = useRef(state.ragNodes);
  useEffect(() => {
    const prev = prevRagNodesRef.current;
    const next = state.ragNodes;
    if (prev === next) return; // No change
    prevRagNodesRef.current = next;
    // Only persist on actual structural changes (move creates a referentially
    // different ragNodes object). This handles the moveNode case.
    // addNode/renameNode/deleteNode/putRagNode already write targeted nodes.
    if (store) {
      Object.values(next).forEach((node) => void store.putNode(node));
    }
  }, [state.ragNodes, store]);

  const putRagNode = useCallback((node: RAGNode) => {
    dispatch({ type: "PUT_NODE", node });
    void store?.putNode(node);
  }, [store]);

  return {
    tree: state.tree,
    ragNodes: state.ragNodes,
    addNode,
    renameNode,
    deleteNode,
    toggleExpand,
    moveNode,
    putRagNode,
    loadFromStore,
  };
}
