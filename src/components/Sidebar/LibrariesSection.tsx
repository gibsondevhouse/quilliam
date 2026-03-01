"use client";

import { memo, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { SidebarNode } from "@/lib/navigation";
import { LibraryRow } from "./LibraryRow";

interface LibrariesSectionProps {
  libraries: SidebarNode[];
  activeLibraryId: string | null;
  searchQuery: string;
  onNewLibrary: () => void;
  onDeleteLibrary: (id: string) => void;
  onRenameLibrary: (id: string) => void;
}

/**
 * Scrollable list of libraries rendered inside the "Libraries" section panel.
 * The list is kept mounted at all times (caller controls visibility via CSS)
 * so the scroll position, focus, and element references survive section
 * switches without re-mounting.
 */
export const LibrariesSection = memo(function LibrariesSection({
  libraries,
  activeLibraryId,
  searchQuery,
  onNewLibrary,
  onDeleteLibrary,
  onRenameLibrary,
}: LibrariesSectionProps) {
  const router = useRouter();

  const filtered = searchQuery
    ? libraries.filter((l) =>
        l.title.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : libraries;

  const handleOpen = useCallback(
    (id: string) => {
      localStorage.setItem("quilliam_last_library", id);
      router.push(`/library/${id}/universe`);
    },
    [router],
  );

  return (
    <div>
      {filtered.length === 0 ? (
        <p className="oc-sidebar-empty">
          {searchQuery ? `No libraries match "${searchQuery}"` : "No libraries yet."}
        </p>
      ) : (
        <ul className="oc-library-list" aria-label="Libraries">
          {filtered.map((lib) => (
            <LibraryRow
              key={lib.id}
              library={lib}
              isActive={lib.id === activeLibraryId}
              onOpen={handleOpen}
              onRename={onRenameLibrary}
              onDelete={onDeleteLibrary}
            />
          ))}
        </ul>
      )}

      <div className="oc-library-actions">
        <button className="oc-library-add-btn" onClick={onNewLibrary}>
          + New Library
        </button>
      </div>
    </div>
  );
});
