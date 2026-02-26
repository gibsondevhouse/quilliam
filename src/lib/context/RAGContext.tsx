"use client";

import { createContext, useContext, type RefObject } from "react";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import type { RAGStore } from "@/lib/rag/store";
import type { SidebarNode } from "@/components/Editor/Sidebar";

export interface RAGContextValue {
  storeRef: RefObject<RAGStore | null>;
  storeReady: boolean;
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

export const RAGContext = createContext<RAGContextValue | null>(null);

export function useRAGContext(): RAGContextValue {
  const ctx = useContext(RAGContext);
  if (!ctx) throw new Error("useRAGContext must be used within a ClientShell");
  return ctx;
}
