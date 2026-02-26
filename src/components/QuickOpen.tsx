"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface QuickOpenItem {
  id: string;
  title: string;
  kind: "chapter" | "scene" | "character" | "location" | "world";
  path: string; // e.g. "My Book / Part 1 / Chapter 3"
}

interface QuickOpenProps {
  open: boolean;
  items: QuickOpenItem[];
  onSelect: (item: QuickOpenItem) => void;
  onClose: () => void;
}

const KIND_ICONS: Record<QuickOpenItem["kind"], string> = {
  chapter: "§",
  scene: "¶",
  character: "⊕",
  location: "◎",
  world: "◈",
};

export function QuickOpen({ open, items, onSelect, onClose }: QuickOpenProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter items by query
  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.path.toLowerCase().includes(q)
    );
  }, [items, query]);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keep selectedIndex in bounds
  useEffect(() => {
    setSelectedIndex((prev) => Math.min(prev, Math.max(0, filtered.length - 1)));
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            onSelect(filtered[selectedIndex]);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  );

  if (!open) return null;

  return (
    <div className="quick-open-overlay" onClick={onClose}>
      <div className="quick-open" onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="quick-open-input-wrap">
          <svg className="quick-open-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            className="quick-open-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Go to file... (chapters, scenes, characters)"
            spellCheck={false}
          />
          <kbd className="quick-open-kbd">ESC</kbd>
        </div>
        <div className="quick-open-list" ref={listRef}>
          {filtered.length === 0 ? (
            <div className="quick-open-empty">No matching documents</div>
          ) : (
            filtered.map((item, i) => (
              <button
                key={item.id}
                className={`quick-open-item ${i === selectedIndex ? "selected" : ""}`}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <span className="quick-open-item-icon">{KIND_ICONS[item.kind]}</span>
                <span className="quick-open-item-title">{item.title || "Untitled"}</span>
                <span className="quick-open-item-path">{item.path}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
