"use client";

import { useEffect, useRef, useState } from "react";
import type { NodeType } from "@/lib/rag/hierarchy";
import type { SidebarNode } from "@/lib/navigation";
import { TYPE_ICONS, TYPE_LABELS } from "./nodeConstants";

interface TreeNodeProps {
  node: SidebarNode;
  depth: number;
  libraryId: string | null;
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
}

export function TreeNode({
  node,
  depth,
  libraryId,
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
}: TreeNodeProps) {
  const [dragOver, setDragOver] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  // Fragment nodes are hidden from the tree UI — they are internal chunking artefacts.
  const hasChildren = node.children.some((c) => c.type !== "fragment");
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
        onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, node.id, node.type); }}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); onDragOver(e, node.id); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { setDragOver(false); onDrop(e, node.id); }}
      >
        <button
          className={`sidebar-expand-btn ${!hasChildren ? "placeholder" : ""}`}
          onClick={(e) => { e.stopPropagation(); if (hasChildren) onToggleExpand(node.id); }}
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
            {node.type === "scene" && node.sceneDocId && libraryId && (
              <a
                href={`/library/${libraryId}/scenes?highlight=${node.sceneDocId}`}
                className="scene-doc-badge"
                title={`Open canonical scene doc: ${node.sceneDocId}`}
                onClick={(e) => e.stopPropagation()}
              >
                ↗
              </a>
            )}
            <span className="sidebar-type-badge">{TYPE_LABELS[node.type]}</span>
          </>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children
            .filter((child) => child.type !== "fragment")
            .map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                depth={depth + 1}
                libraryId={libraryId}
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
