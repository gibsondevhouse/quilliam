"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSidebar } from "@/lib/context/SidebarContext";
import { useSidebarData } from "@/lib/context/SidebarDataContext";
import { SIDEBAR_GROUPS } from "@/lib/sidebarGroups";

/**
 * DomainNavAccordion
 *
 * Renders the 7 domain groups as a single-open accordion.
 * Each child link navigates to /library/[activeLibraryId]/[path].
 * Active child is detected via usePathname().
 * Open group is persisted in SidebarContext (localStorage keyed by group label).
 */
export function DomainNavAccordion() {
  const { openGroupId, setOpenGroupId } = useSidebar();
  const pageData = useSidebarData();
  const pathname = usePathname();
  const router = useRouter();

  // Resolve active library — from registered page data, then localStorage fallback
  const activeLibraryId =
    pageData?.activeLibraryId ??
    (typeof window !== "undefined"
      ? localStorage.getItem("quilliam_last_library")
      : null);

  const handleGroupClick = useCallback(
    (label: string) => {
      setOpenGroupId(openGroupId === label ? null : label);
    },
    [openGroupId, setOpenGroupId],
  );

  const handleChildClick = useCallback(
    (path: string) => {
      if (!activeLibraryId) return;
      router.push(`/library/${activeLibraryId}/${path}`);
    },
    [activeLibraryId, router],
  );

  return (
    <nav className="oc-domain-nav" aria-label="Domain navigation">
      {!activeLibraryId && (
        <p className="oc-sidebar-empty" style={{ fontSize: 11, padding: "12px 14px" }}>
          Open a library to navigate its content.
        </p>
      )}

      {SIDEBAR_GROUPS.map((group) => {
        const isOpen = openGroupId === group.label;

        // Determine if any child in this group matches the current route
        const hasActiveChild = activeLibraryId
          ? group.items.some((item) =>
              pathname?.includes(`/library/${activeLibraryId}/${item.path}`),
            )
          : false;

        return (
          <div key={group.label} className="oc-domain-group" data-open={isOpen ? "true" : "false"}>
            <button
              className="oc-domain-group-header"
              data-active={hasActiveChild ? "true" : "false"}
              onClick={() => handleGroupClick(group.label)}
              aria-expanded={isOpen}
            >
              <span className="oc-domain-group-icon" aria-hidden>
                {group.icon}
              </span>
              <span className="oc-domain-group-label">{group.label}</span>
              <span className="oc-domain-group-chevron" aria-hidden>
                {isOpen ? "▾" : "›"}
              </span>
            </button>

            <div className="oc-domain-group-children" aria-hidden={!isOpen}>
              {!activeLibraryId ? (
                <p className="oc-domain-no-library">No library selected</p>
              ) : (
                group.items.map((item) => {
                  const href = `/library/${activeLibraryId}/${item.path}`;
                  const isActive = pathname?.startsWith(href) ?? false;
                  return (
                    <button
                      key={item.path}
                      className="oc-domain-child-link"
                      data-active={isActive ? "true" : "false"}
                      onClick={() => handleChildClick(item.path)}
                      aria-current={isActive ? "page" : undefined}
                      tabIndex={isOpen ? 0 : -1}
                    >
                      {item.label}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
