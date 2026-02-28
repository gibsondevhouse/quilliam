/**
 * Pure reducer for the library sidebar tree state.
 *
 * All mutations that previously lived as `useCallback` closures with stale-
 * closure workarounds in ClientShell (treeRef/ragNodesRef mirrors) are now
 * expressed as reducer cases. The reducer has full access to current state on
 * every action — no refs or manual mirrors needed.
 *
 * Side effects (IDB persistence) are intentionally absent here; they live in
 * the `useLibraryTree` hook alongside the `dispatch` calls.
 */

import type { SidebarNode } from "@/lib/navigation";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import { isValidChild } from "@/lib/rag/hierarchy";
import {
  addChildToNode,
  buildSidebarTreeFromRAG,
  containsNode,
  deleteFromTree,
  findNode,
  insertChild,
  isDescendantNode,
  rebuildRagNodesFromTree,
  removeFromTree,
  renameInTree,
  toggleExpandInTree,
} from "@/lib/treeUtils";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface LibraryTreeState {
  tree: SidebarNode[];
  ragNodes: Record<string, RAGNode>;
}

export const INITIAL_TREE_STATE: LibraryTreeState = {
  tree: [],
  ragNodes: {},
};

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

export type LibraryTreeAction =
  | {
      type: "LOAD";
      nodes: RAGNode[];
    }
  | {
      type: "ADD_NODE";
      parentId: string | null;
      nodeType: NodeType;
      id: string;
      ragNode: RAGNode;
      sidebarNode: SidebarNode;
    }
  | {
      type: "RENAME_NODE";
      id: string;
      title: string;
      updatedAt: number;
    }
  | {
      type: "DELETE_NODE";
      id: string;
    }
  | {
      type: "TOGGLE_EXPAND";
      id: string;
    }
  | {
      type: "MOVE_NODE";
      dragId: string;
      targetId: string;
    }
  | {
      type: "PUT_NODE";
      node: RAGNode;
    };

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export function libraryTreeReducer(
  state: LibraryTreeState,
  action: LibraryTreeAction,
): LibraryTreeState {
  switch (action.type) {
    case "LOAD": {
      const ragNodes = action.nodes.reduce<Record<string, RAGNode>>(
        (acc, n) => { acc[n.id] = n; return acc; },
        {},
      );
      return { tree: buildSidebarTreeFromRAG(action.nodes), ragNodes };
    }

    case "ADD_NODE": {
      const { parentId, id, ragNode, sidebarNode } = action;
      const nextTree =
        parentId === null
          ? [...state.tree, sidebarNode]
          : insertChild(state.tree, parentId, sidebarNode);

      const nextRagNodes: Record<string, RAGNode> = { ...state.ragNodes, [id]: ragNode };
      if (parentId && state.ragNodes[parentId]) {
        nextRagNodes[parentId] = {
          ...state.ragNodes[parentId],
          childrenIds: [...state.ragNodes[parentId].childrenIds, id],
        };
      }
      return { tree: nextTree, ragNodes: nextRagNodes };
    }

    case "RENAME_NODE": {
      const { id, title, updatedAt } = action;
      const existing = state.ragNodes[id];
      if (!existing) return state;
      return {
        tree: renameInTree(state.tree, id, title),
        ragNodes: { ...state.ragNodes, [id]: { ...existing, title, updatedAt } },
      };
    }

    case "DELETE_NODE": {
      const { id } = action;
      const removedNode = findNode(state.tree, id);
      if (!removedNode) return state;
      const nextTree = deleteFromTree(state.tree, id);
      const rebuilt = rebuildRagNodesFromTree(nextTree, state.ragNodes);
      return { tree: nextTree, ragNodes: rebuilt };
    }

    case "TOGGLE_EXPAND": {
      return { ...state, tree: toggleExpandInTree(state.tree, action.id) };
    }

    case "MOVE_NODE": {
      const { dragId, targetId } = action;
      const dragNode = state.ragNodes[dragId];
      const targetNode = state.ragNodes[targetId];
      if (!dragNode || !targetNode) return state;
      if (!isValidChild(targetNode.type, dragNode.type)) return state;
      if (isDescendantNode(state.ragNodes, dragId, targetId)) return state;

      const { remaining, removed } = removeFromTree(state.tree, dragId);
      if (!removed) return state;
      const nextTree = addChildToNode(remaining, targetId, removed);
      if (!containsNode(nextTree, dragId)) return state;

      const rebuilt = rebuildRagNodesFromTree(nextTree, state.ragNodes);
      return { tree: nextTree, ragNodes: rebuilt };
    }

    case "PUT_NODE": {
      return {
        ...state,
        ragNodes: { ...state.ragNodes, [action.node.id]: action.node },
      };
    }

    default:
      return state;
  }
}
