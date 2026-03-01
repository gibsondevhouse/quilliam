"use client";

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import type { SidebarNode } from "@/lib/navigation";

// ---------------------------------------------------------------------------
// Inline context menu (3-dot popover)
// ---------------------------------------------------------------------------

interface LibraryRowMenuProps {
  onOpen: () => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
}

function LibraryRowMenu({
  onOpen,
  onRename,
  onDelete,
  onClose,
  anchorRef,
}: LibraryRowMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({ position: "fixed", top: 0, left: 0, zIndex: 202 });

  // Calculate position after mount (avoids reading ref during render)
  useEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setStyle({
      position: "fixed",
      top: rect.bottom + 4,
      left: Math.min(rect.left, window.innerWidth - 160),
      zIndex: 202,
    });
  }, [anchorRef]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node) &&
        !anchorRef.current?.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [anchorRef, onClose]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div ref={menuRef} className="ctx-menu" style={style}>
      <button
        className="ctx-menu-item"
        onClick={() => {
          onOpen();
          onClose();
        }}
      >
        Open workspace
      </button>
      <button
        className="ctx-menu-item"
        onClick={() => {
          onRename();
          onClose();
        }}
      >
        Rename
      </button>
      <div className="ctx-menu-divider" />
      <button
        className="ctx-menu-item danger"
        onClick={() => {
          onDelete();
          onClose();
        }}
      >
        Delete
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LibraryRow
// ---------------------------------------------------------------------------

interface LibraryRowProps {
  library: SidebarNode;
  isActive: boolean;
  onOpen: (id: string) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
}

export const LibraryRow = memo(function LibraryRow({
  library,
  isActive,
  onOpen,
  onRename,
  onDelete,
}: LibraryRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);

  const handleOpen = useCallback(() => onOpen(library.id), [library.id, onOpen]);
  const handleRename = useCallback(() => onRename(library.id), [library.id, onRename]);
  const handleDelete = useCallback(() => onDelete(library.id), [library.id, onDelete]);
  const handleMenuToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setMenuOpen((v) => !v);
    },
    [],
  );

  // Resolve first letter of library name for placeholder thumbnail
  const initial = library.title.charAt(0).toUpperCase() || "L";

  const chapterMeta =
    library.chapterCount !== undefined && library.chapterCount > 0
      ? `${library.chapterCount} chapter${library.chapterCount === 1 ? "" : "s"}`
      : null;

  return (
    <li>
      <div
        className="oc-library-row"
        data-active={isActive ? "true" : "false"}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        aria-label={`Open ${library.title}`}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen();
          }
        }}
      >
        {/* Thumbnail */}
        <div className="oc-library-thumb" aria-hidden>
          {library.coverImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={library.coverImageUrl}
              alt=""
              loading="lazy"
              decoding="async"
            />
          ) : (
            <span className="oc-library-thumb-placeholder">{initial}</span>
          )}
        </div>

        {/* Info */}
        <div className="oc-library-info">
          <span className="oc-library-name">{library.title}</span>
          {chapterMeta && (
            <span className="oc-library-meta">{chapterMeta}</span>
          )}
        </div>

        {/* Context menu trigger */}
        <button
          ref={menuBtnRef}
          className="oc-library-menu-btn"
          onClick={handleMenuToggle}
          aria-label={`More options for ${library.title}`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
        >
          ⋯
        </button>
      </div>

      {menuOpen && (
        <LibraryRowMenu
          anchorRef={menuBtnRef}
          onOpen={handleOpen}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setMenuOpen(false)}
        />
      )}
    </li>
  );
});
