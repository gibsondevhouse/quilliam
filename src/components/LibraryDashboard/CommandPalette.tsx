"use client";

import type { RefObject } from "react";
import type { SearchItem } from "./types";

interface CommandPaletteProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedSearchIndex: number;
  setSelectedSearchIndex: (i: number) => void;
  filteredSearchItems: SearchItem[];
  handleSearchSelect: (item: SearchItem) => void;
  onClose: () => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
}

export function CommandPalette({
  searchQuery,
  setSearchQuery,
  selectedSearchIndex,
  setSelectedSearchIndex,
  filteredSearchItems,
  handleSearchSelect,
  onClose,
  searchInputRef,
}: CommandPaletteProps) {
  const selectedItem = filteredSearchItems[selectedSearchIndex];

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={(e) => e.stopPropagation()}>
        <div className="cmd-palette-input-wrap">
          <span className="cmd-palette-chevron">›</span>
          <input
            ref={searchInputRef}
            className="cmd-palette-input"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSelectedSearchIndex(0);
            }}
            placeholder="Search modules, books, entries..."
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setSelectedSearchIndex(Math.max(0, Math.min(filteredSearchItems.length - 1, selectedSearchIndex + 1)));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setSelectedSearchIndex(Math.max(0, selectedSearchIndex - 1));
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (selectedItem) handleSearchSelect(selectedItem);
              }
              if (e.key === "Escape") onClose();
            }}
          />
        </div>
        <div className="cmd-palette-list">
          {filteredSearchItems.length === 0 ? (
            <div className="cmd-palette-empty">No matches found.</div>
          ) : (
            filteredSearchItems.map((item, index) => (
              <button
                key={item.id}
                className={`cmd-palette-item${index === selectedSearchIndex ? " selected" : ""}`}
                onClick={() => handleSearchSelect(item)}
                onMouseEnter={() => setSelectedSearchIndex(index)}
              >
                <span className="cmd-palette-item-icon">{item.icon}</span>
                <span className="cmd-palette-item-label">{item.label}</span>
                <span className="cmd-palette-item-kbd">{item.hint}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
