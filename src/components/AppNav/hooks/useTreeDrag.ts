"use client";

import { useCallback, useState } from "react";
import type { RAGNode } from "@/lib/rag/hierarchy";
import { VALID_CHILDREN } from "@/lib/rag/hierarchy";

interface UseTreeDragParams {
  ragNodes: Record<string, RAGNode>;
  onMoveNode: (dragId: string, targetId: string) => void;
}

interface UseTreeDragReturn {
  handleDragStart: (e: React.DragEvent, nodeId: string) => void;
  handleDragOver: (e: React.DragEvent, targetId: string) => void;
  handleDrop: (e: React.DragEvent, targetId: string) => void;
}

function isDescendant(ragNodes: Record<string, RAGNode>, ancestorId: string, candidateId: string): boolean {
  let current = ragNodes[candidateId];
  while (current) {
    if (current.parentId === ancestorId) return true;
    if (!current.parentId) return false;
    current = ragNodes[current.parentId];
  }
  return false;
}

export function useTreeDrag({ ragNodes, onMoveNode }: UseTreeDragParams): UseTreeDragReturn {
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(nodeId);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedId || draggedId === targetId) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      const dragNode = ragNodes[draggedId];
      const targetNode = ragNodes[targetId];
      if (!dragNode || !targetNode) {
        e.dataTransfer.dropEffect = "none";
        return;
      }
      const legalParentChild = VALID_CHILDREN[targetNode.type].includes(dragNode.type);
      const createsCycle = isDescendant(ragNodes, draggedId, targetId);
      e.dataTransfer.dropEffect = legalParentChild && !createsCycle ? "move" : "none";
    },
    [draggedId, ragNodes],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (draggedId && draggedId !== targetId) {
        const dragNode = ragNodes[draggedId];
        const targetNode = ragNodes[targetId];
        if (!dragNode || !targetNode) { setDraggedId(null); return; }
        if (!VALID_CHILDREN[targetNode.type].includes(dragNode.type)) { setDraggedId(null); return; }
        if (isDescendant(ragNodes, draggedId, targetId)) { setDraggedId(null); return; }
        onMoveNode(draggedId, targetId);
      }
      setDraggedId(null);
    },
    [draggedId, onMoveNode, ragNodes],
  );

  return { handleDragStart, handleDragOver, handleDrop };
}
