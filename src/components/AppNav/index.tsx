"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import type { SidebarNode } from "@/lib/navigation";
import { ContextMenu, type ContextMenuState } from "./ContextMenu";
import { TreeNode } from "./TreeNode";
import { useTreeDrag } from "./hooks/useTreeDrag";
import { useTreeRename } from "./hooks/useTreeRename";

export interface AppNavProps {
  tree: SidebarNode[];
  ragNodes: Record<string, RAGNode>;
  libraryId: string | null;
  activeNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onAddChild: (parentId: string | null, childType: NodeType) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onDeleteNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string) => void;
  dirtyIds: Set<string>;
}

export function AppNav({
  tree,
  ragNodes,
  libraryId,
  activeNodeId,
  onNodeSelect,
  onAddChild,
  onRenameNode,
  onDeleteNode,
  onToggleExpand,
  onMoveNode,
  dirtyIds,
}: AppNavProps) {
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);

  const { renamingId, renameValue, setRenameValue, startRename, commitRename, cancelRename } =
    useTreeRename({ tree, onRenameNode });

  const { handleDragStart, handleDragOver, handleDrop } = useTreeDrag({ ragNodes, onMoveNode });

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeType: NodeType) => {
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId, nodeType });
    },
    [],
  );
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  if (collapsed) {
    return (
      <button
        className="app-nav-expand-btn"
        onClick={() => setCollapsed(false)}
        title="Expand navigation"
        aria-label="Expand navigation"
      >
        »
      </button>
    );
  }

  return (
    <nav className="app-nav">
      <div className="app-nav-brand">
        <span>🪶</span>
        <span>Quilliam</span>
      </div>

      <button className="app-nav-new-btn" onClick={() => router.push("/")}>
        <span>+</span>
        <span>New conversation</span>
      </button>

      <div className="app-nav-section-label">Libraries</div>

      <div className="app-nav-tree">
        {tree.length === 0 ? (
          <div className="sidebar-empty">
            <p>Your libraries will appear here.</p>
            <p className="sidebar-empty-hint">Start a new conversation to begin writing.</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              libraryId={libraryId}
              activeNodeId={activeNodeId}
              renamingId={renamingId}
              renameValue={renameValue}
              onNodeSelect={onNodeSelect}
              onContextMenu={handleContextMenu}
              onToggleExpand={onToggleExpand}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onRenameValueChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={cancelRename}
              onDoubleClick={startRename}
              dirtyIds={dirtyIds}
            />
          ))
        )}
      </div>

      <div className="app-nav-secondary">
        <button className="app-nav-new-library-btn" onClick={() => onAddChild(null, "library")}>
          + New Library
        </button>
      </div>

      <div className="app-nav-footer">
        <button
          className="app-nav-collapse-btn"
          onClick={() => setCollapsed(true)}
          title="Collapse navigation"
          aria-label="Collapse navigation"
        >
          «
        </button>
      </div>

      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          onAddChild={(ct) => { onAddChild(ctxMenu.nodeId, ct); closeCtx(); }}
          onRename={() => { startRename(ctxMenu.nodeId); closeCtx(); }}
          onDelete={() => { onDeleteNode(ctxMenu.nodeId); closeCtx(); }}
          onClose={closeCtx}
        />
      )}
    </nav>
  );
}
