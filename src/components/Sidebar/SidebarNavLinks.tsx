"use client";

import { usePathname, useRouter } from "next/navigation";

interface NavLink {
  label: string;
  icon: string;
  href?: string;
  onClick?: () => void;
}

interface SidebarNavLinksProps {
  lastLibraryId: string | null;
}

/**
 * Primary navigation links below the header.
 * Maps Quilliam routes to the ChatGPT-style link list.
 */
export function SidebarNavLinks({ lastLibraryId }: SidebarNavLinksProps) {
  const pathname = usePathname();
  const router = useRouter();

  const links: NavLink[] = [
    {
      label: "Library workspace",
      icon: "📚",
      href: lastLibraryId ? `/library/${lastLibraryId}/universe` : undefined,
    },
    {
      label: "Deep research",
      icon: "🔬",
      href: lastLibraryId ? `/library/${lastLibraryId}/research` : undefined,
    },
    {
      label: "Analytics",
      icon: "📊",
      href: lastLibraryId ? `/library/${lastLibraryId}/analytics` : undefined,
    },
    {
      label: "Maps",
      icon: "🗺️",
      href: lastLibraryId ? `/library/${lastLibraryId}/maps` : undefined,
    },
    {
      label: "Timeline",
      icon: "⏳",
      href: lastLibraryId ? `/library/${lastLibraryId}/timeline` : undefined,
    },
  ].filter((l) => Boolean(l.href));

  return (
    <nav className="oc-sidebar-nav" aria-label="Primary navigation">
      {links.map((link) => {
        const isActive = link.href ? pathname?.startsWith(link.href) : false;
        return (
          <button
            key={link.label}
            className="oc-sidebar-nav-link"
            data-active={isActive ? "true" : "false"}
            onClick={() => link.href && router.push(link.href)}
            aria-current={isActive ? "page" : undefined}
          >
            <span className="oc-sidebar-nav-icon" aria-hidden>
              {link.icon}
            </span>
            {link.label}
          </button>
        );
      })}

      {!lastLibraryId && (
        <p className="oc-sidebar-empty" style={{ fontSize: 11, padding: "8px 10px" }}>
          Open a library to see workspace links.
        </p>
      )}
    </nav>
  );
}
