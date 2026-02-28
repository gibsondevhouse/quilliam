"use client";

import { useCallback, useState } from "react";
import type { SidebarNode } from "@/lib/navigation";

interface UseTreeRenameParams {
  tree: SidebarNode[];
  onRenameNode: (id: string, newTitle: string) => void;
}

interface UseTreeRenameReturn {
  renamingId: string | null;
  renameValue: string;
  setRenameValue: (val: string) => void;
  startRename: (nodeId: string) => void;
  commitRename: () => void;
  cancelRename: () => void;
}

function findTitle(nodes: SidebarNode[], nodeId: string): string {
  for (const n of nodes) {
    if (n.id === nodeId) return n.title;
    const found = findTitle(n.children, nodeId);
    if (found) return found;
  }
  return "";
}

export function useTreeRename({ tree, onRenameNode }: UseTreeRenameParams): UseTreeRenameReturn {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const startRename = useCallback(
    (nodeId: string) => {
      setRenamingId(nodeId);
      setRenameValue(findTitle(tree, nodeId));
    },
    [tree],
  );

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameNode(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRenameNode]);

  const cancelRename = useCallback(() => setRenamingId(null), []);

  return { renamingId, renameValue, setRenameValue, startRename, commitRename, cancelRename };
}
