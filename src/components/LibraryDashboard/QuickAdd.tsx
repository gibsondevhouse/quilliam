"use client";

import type { RefObject } from "react";
import type { QuickAddAction } from "./types";

interface QuickAddProps {
  open: boolean;
  onToggle: () => void;
  actions: QuickAddAction[];
  containerRef: RefObject<HTMLDivElement | null>;
}

export function QuickAdd({ open, onToggle, actions, containerRef }: QuickAddProps) {
  return (
    <div className="library-dashboard-quick-add-wrap" ref={containerRef}>
      <button className="library-dashboard-action" onClick={onToggle}>
        Quick Add +
      </button>
      {open && (
        <div className="library-dashboard-quick-add-menu">
          {actions.map((item) => (
            <button
              key={item.id}
              className="library-dashboard-quick-add-item"
              onClick={item.action}
            >
              <span>{item.label}</span>
              <span className="library-dashboard-quick-add-hint">{item.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
