"use client";

import { useEffect, useRef } from "react";
import type { NodeType } from "@/lib/rag/hierarchy";
import { VALID_CHILDREN } from "@/lib/rag/hierarchy";
import { TYPE_ICONS, TYPE_LABELS } from "./nodeConstants";

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeType: NodeType;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onAddChild: (childType: NodeType) => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ menu, onAddChild, onRename, onDelete, onClose }: ContextMenuProps) {
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
      <button className="ctx-menu-item" onClick={onRename}>Rename</button>
      <button className="ctx-menu-item danger" onClick={onDelete}>Delete</button>
    </div>
  );
}
