"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { NodeType, RAGNode } from "@/lib/rag/hierarchy";
import { VALID_CHILDREN } from "@/lib/rag/hierarchy";
import type { SidebarNode } from "@/lib/navigation";

/* ================================================================
   Types
   ================================================================ */

export interface AppNavProps {
  tree: SidebarNode[];
  ragNodes: Record<string, RAGNode>;
  activeNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onAddChild: (parentId: string | null, childType: NodeType) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onDeleteNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string) => void;
  dirtyIds: Set<string>;
}

/* ================================================================
   Node display maps
   ================================================================ */

const TYPE_ICONS: Record<NodeType, string> = {
  library: "📚",
  book: "📖",
  part: "◆",
  chapter: "§",
  scene: "¶",
  fragment: "·",
};

const TYPE_LABELS: Record<NodeType, string> = {
  library: "Library",
  book: "Book",
  part: "Part",
  chapter: "Chapter",
  scene: "Scene",
  fragment: "Fragment",
};

/* ================================================================
   Context Menu
   ================================================================ */

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeType: NodeType;
}

function ContextMenu({
  menu,
  onAddChild,
  onRename,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  onAddChild: (childType: NodeType) => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const validChildren = VALID_CHILDREN[menu.nodeType];

  return (
    <div ref={ref} className="ctx-menu" style={{ top: menu.y, left: menu.x }}>
      {validChildren.map((ct) => (
        <button key={ct} className="ctx-menu-item" onClick={() => onAddChild(ct)}>
          {TYPE_ICONS[ct]} New {TYPE_LABELS[ct]}
        </button>
      ))}
      {validChildren.length > 0 && <div className="ctx-menu-divider" />}
      <button className="ctx-menu-item" onClick={onRename}>
        Rename
      </button>
      <button className="ctx-menu-item danger" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

/* ================================================================
   Tree Node
   ================================================================ */

function TreeNode({
  node,
  depth,
  activeNodeId,
  renamingId,
  renameValue,
  onNodeSelect,
  onContextMenu,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel,
  onDoubleClick,
  dirtyIds,
}: {
  node: SidebarNode;
  depth: number;
  activeNodeId: string | null;
  renamingId: string | null;
  renameValue: string;
  onNodeSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string, nodeType: NodeType) => void;
  onToggleExpand: (id: string) => void;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onDragOver: (e: React.DragEvent, nodeId: string) => void;
  onDrop: (e: React.DragEvent, nodeId: string) => void;
  onRenameValueChange: (val: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDoubleClick: (id: string) => void;
  dirtyIds: Set<string>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activeNodeId;
  const isRenaming = node.id === renamingId;
  const expanded = node.isExpanded ?? true;
  const isDirty = dirtyIds.has(node.id);

  useEffect(() => {
    if (isRenaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <div>
      <div
        className={`sidebar-tree-item ${isActive ? "active" : ""} ${dragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        draggable={!isRenaming}
        onClick={() => onNodeSelect(node.id)}
        onDoubleClick={() => onDoubleClick(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node.id, node.type);
        }}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
          onDragOver(e, node.id);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          onDrop(e, node.id);
        }}
      >
        <button
          className={`sidebar-expand-btn ${!hasChildren ? "placeholder" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
        >
          {hasChildren && (
            <span className={`sidebar-expand-icon ${expanded ? "expanded" : ""}`}>▸</span>
          )}
        </button>
        <span className="sidebar-type-icon">{TYPE_ICONS[node.type]}</span>
        {isRenaming ? (
          <input
            ref={renameRef}
            className="sidebar-rename-input"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameCommit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="sidebar-item-label">{node.title}</span>
            {isDirty && <span className="sidebar-dirty-dot" title="Unsaved changes" />}
            <span className="sidebar-type-badge">{TYPE_LABELS[node.type]}</span>
          </>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              renamingId={renamingId}
              renameValue={renameValue}
              onNodeSelect={onNodeSelect}
              onContextMenu={onContextMenu}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onRenameValueChange={onRenameValueChange}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onDoubleClick={onDoubleClick}
              dirtyIds={dirtyIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   AppNav
   ================================================================ */

export function AppNav({
  tree,
  ragNodes,
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
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [draggedId, setDraggedId] = useState<string | null>(null);

  const isDescendant = useCallback((ancestorId: string, candidateId: string) => {
    let current = ragNodes[candidateId];
    while (current) {
      if (current.parentId === ancestorId) return true;
      if (!current.parentId) return false;
      current = ragNodes[current.parentId];
    }
    return false;
  }, [ragNodes]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, nodeId: string, nodeType: NodeType) => {
      setCtxMenu({ x: e.clientX, y: e.clientY, nodeId, nodeType });
    },
    []
  );
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const startRename = useCallback(
    (nodeId: string) => {
      const findTitle = (nodes: SidebarNode[]): string => {
        for (const n of nodes) {
          if (n.id === nodeId) return n.title;
          const found = findTitle(n.children);
          if (found) return found;
        }
        return "";
      };
      setRenamingId(nodeId);
      setRenameValue(findTitle(tree));
    },
    [tree]
  );

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameNode(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRenameNode]);

  const cancelRename = useCallback(() => setRenamingId(null), []);

  const handleDragStart = useCallback((e: React.DragEvent, nodeId: string) => {
    e.dataTransfer.effectAllowed = "move";
    setDraggedId(nodeId);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, targetId: string) => {
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
    const createsCycle = isDescendant(draggedId, targetId);
    e.dataTransfer.dropEffect = legalParentChild && !createsCycle ? "move" : "none";
  }, [draggedId, isDescendant, ragNodes]);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (draggedId && draggedId !== targetId) {
        const dragNode = ragNodes[draggedId];
        const targetNode = ragNodes[targetId];
        if (!dragNode || !targetNode) {
          setDraggedId(null);
          return;
        }
        if (!VALID_CHILDREN[targetNode.type].includes(dragNode.type)) {
          setDraggedId(null);
          return;
        }
        if (isDescendant(draggedId, targetId)) {
          setDraggedId(null);
          return;
        }
        onMoveNode(draggedId, targetId);
      }
      setDraggedId(null);
    },
    [draggedId, isDescendant, onMoveNode, ragNodes]
  );

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
      {/* Brand wordmark */}
      <div className="app-nav-brand">
        <span>🪶</span>
        <span>Quilliam</span>
      </div>

      {/* Primary CTA */}
      <button className="app-nav-new-btn" onClick={() => router.push("/")}>
        <span>+</span>
        <span>New conversation</span>
      </button>

      {/* Section label */}
      <div className="app-nav-section-label">Libraries</div>

      {/* Tree */}
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

      {/* Secondary action */}
      <div className="app-nav-secondary">
        <button
          className="app-nav-new-library-btn"
          onClick={() => onAddChild(null, "library")}
        >
          + New Library
        </button>
      </div>

      {/* Footer: collapse toggle */}
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

      {/* Context menu */}
      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          onAddChild={(ct) => {
            onAddChild(ctxMenu.nodeId, ct);
            closeCtx();
          }}
          onRename={() => {
            startRename(ctxMenu.nodeId);
            closeCtx();
          }}
          onDelete={() => {
            onDeleteNode(ctxMenu.nodeId);
            closeCtx();
          }}
          onClose={closeCtx}
        />
      )}
    </nav>
  );
}
