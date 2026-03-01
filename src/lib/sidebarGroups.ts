/**
 * SIDEBAR_GROUPS — single source of truth for the domain navigation hierarchy.
 *
 * Used by:
 *  - src/components/Sidebar/DomainNavAccordion.tsx  (global off-canvas sidebar)
 *  - src/app/library/[libraryId]/layout.tsx          (in-workspace side nav)
 */

export interface SidebarGroupItem {
  label: string;
  path: string;
}

export interface SidebarGroup {
  label: string;
  icon: string;
  items: readonly SidebarGroupItem[];
}

export const SIDEBAR_GROUPS = [
  {
    label: "Universe Core",
    icon: "🌌",
    items: [
      { label: "Overview", path: "universe" },
      { label: "Master Timeline", path: "master-timeline" },
      { label: "Cosmology", path: "cosmology" },
      { label: "Magic/Tech Systems", path: "magic-systems" },
      { label: "Rules of Reality", path: "rules" },
    ],
  },
  {
    label: "World Structures",
    icon: "🗺️",
    items: [
      { label: "Regions & Locations", path: "locations" },
      { label: "Cultures", path: "cultures" },
      { label: "Religions", path: "religions" },
      { label: "Languages", path: "languages" },
      { label: "Economics", path: "economics" },
    ],
  },
  {
    label: "Power Structures",
    icon: "⚔️",
    items: [
      { label: "Kingdoms & Empires", path: "organizations" },
      { label: "Factions & Orders", path: "factions" },
      { label: "Conflicts", path: "conflicts" },
    ],
  },
  {
    label: "Cast & Lineages",
    icon: "👥",
    items: [
      { label: "Characters", path: "characters" },
      { label: "Lineages", path: "lineages" },
      { label: "Relationship Web", path: "relationship-web" },
    ],
  },
  {
    label: "Artifacts & Media",
    icon: "🏺",
    items: [
      { label: "Items & Relics", path: "items" },
      { label: "Maps", path: "maps" },
      { label: "Media Library", path: "media" },
    ],
  },
  {
    label: "Manuscripts",
    icon: "📖",
    items: [
      { label: "Books", path: "books" },
      { label: "Scenes", path: "scenes" },
    ],
  },
  {
    label: "Intelligence",
    icon: "🧠",
    items: [
      { label: "Suggestions", path: "suggestions" },
      { label: "Continuity Issues", path: "continuity-issues" },
      { label: "Analytics", path: "analytics" },
      { label: "Branch Diff", path: "branches" },
      { label: "Change Log", path: "change-log" },
    ],
  },
] as const satisfies SidebarGroup[];
