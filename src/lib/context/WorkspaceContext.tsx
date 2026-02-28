"use client";

import { createContext, useContext } from "react";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import type { RAGStore } from "@/lib/rag/store";
import type { SidebarNode } from "@/lib/navigation";

export interface WorkspaceContextValue {
  /** Null until the IDB store has been initialised; non-null thereafter. */
  store: RAGStore | null;
  tree: SidebarNode[];
  ragNodes: Record<string, RAGNode>;
  /**
   * Add a new child node (or root node if parentId is null).
   * Returns the new node's id.
   */
  addNode: (parentId: string | null, type: NodeType) => string;
  renameNode: (id: string, title: string) => void;
  deleteNode: (id: string) => void;
  toggleExpand: (id: string) => void;
  moveNode: (dragId: string, targetId: string) => void;
  /** Update a node's content (used by chapter editors in LibraryLayout). */
  putRagNode: (node: RAGNode) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspaceContext(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspaceContext must be used within a ClientShell");
  return ctx;
}

// ---------------------------------------------------------------------------
// Deprecated aliases — kept for one migration window, then removed.
// ---------------------------------------------------------------------------

/** @deprecated Use WorkspaceContextValue */
export type RAGContextValue = WorkspaceContextValue;

/** @deprecated Use WorkspaceContext */
export const RAGContext = WorkspaceContext;

/** @deprecated Use useWorkspaceContext */
export const useRAGContext = useWorkspaceContext;
