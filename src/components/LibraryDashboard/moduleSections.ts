/**
 * LibraryDashboard — static module section configuration.
 */
import type { ModuleSectionConfig } from "./types";

export const MODULE_SECTIONS: ModuleSectionConfig[] = [
  {
    key: "universe-core",
    label: "Universe Core",
    cards: [
      { key: "overview",  label: "Overview",           path: "universe",        description: "Universe brief, baseline lore, and author-facing summary.", cta: "Open Overview", icon: "◎" },
      { key: "timeline",  label: "Master Timeline",    path: "master-timeline", description: "Canonical chronology of eras and events.",                  cta: "Add Event",     icon: "⏱" },
      { key: "cosmology", label: "Cosmology",          path: "cosmology",       description: "Creation myths, metaphysics, and cosmological model.",       cta: "Edit Cosmology",icon: "✶" },
      { key: "systems",   label: "Magic/Tech Systems", path: "magic-systems",   description: "Power systems and operating constraints.",                   cta: "Add System",    icon: "⚙" },
      { key: "rules",     label: "Rules of Reality",   path: "rules",           description: "Fundamental laws and non-negotiable constraints.",           cta: "Add Rule",      icon: "◈" },
    ],
  },
  {
    key: "world-structures",
    label: "World Structures",
    cards: [
      { key: "locations",  label: "Regions & Locations", path: "locations",  description: "Geography, settlements, and world anchors.",          cta: "Add Location", icon: "⌂" },
      { key: "cultures",   label: "Cultures",            path: "cultures",   description: "Culture ontology, subcultures, and evolution.",        cta: "Add Culture",  icon: "⚑" },
      { key: "religions",  label: "Religions",           path: "religions",  description: "Beliefs, rites, and institutions.",                    cta: "Add Religion", icon: "☽" },
      { key: "languages",  label: "Languages",           path: "languages",  description: "Language families, scripts, and naming norms.",        cta: "Add Language", icon: "✎" },
      { key: "economics",  label: "Economics",           path: "economics",  description: "Trade systems, currencies, and resources.",            cta: "Add Economy",  icon: "¤" },
      { key: "laws",       label: "Laws",                path: "rules",      description: "Legal frameworks and civil enforcement.",              cta: "Add Law",      icon: "⚖" },
    ],
  },
  {
    key: "power-structures",
    label: "Power Structures",
    cards: [
      { key: "organizations", label: "Kingdoms & Empires",    path: "organizations", description: "States, houses, and power blocs.",                       cta: "Add Polity",        icon: "♜" },
      { key: "factions",      label: "Factions & Orders",     path: "factions",      description: "Guilds, orders, cells, and influence networks.",          cta: "Add Faction",       icon: "⚔" },
      { key: "conflicts",     label: "Conflicts & Treaties",  path: "conflicts",     description: "Wars, alliances, and diplomatic pressure points.",         cta: "Review Conflicts",  icon: "☍" },
    ],
  },
  {
    key: "cast-lineages",
    label: "Cast & Lineages",
    cards: [
      { key: "characters",        label: "Characters",       path: "characters",        description: "Major cast, supporting cast, and POV network.",          cta: "Add Character", icon: "☺" },
      { key: "lineages",          label: "Lineages",         path: "lineages",          description: "Houses, clans, and bloodline structures.",               cta: "Add Lineage",   icon: "⟟" },
      { key: "relationship-web",  label: "Relationship Web", path: "relationship-web",  description: "Connections view for multi-hop character links.",         cta: "Open Graph",    icon: "⤳" },
    ],
  },
  {
    key: "artifacts-media",
    label: "Artifacts & Media",
    cards: [
      { key: "items", label: "Items & Relics",  path: "items", description: "Artifacts, ownership, and provenance tracking.",            cta: "Add Item",       icon: "◆" },
      { key: "maps",  label: "Maps",            path: "maps",  description: "Spatial visualization with map pins and regions.",          cta: "New Map",        icon: "🗺" },
      { key: "media", label: "Media Library",   path: "media", description: "Attached references, art, and source media.",              cta: "Upload Media",   icon: "▣" },
    ],
  },
  {
    key: "manuscripts",
    label: "Manuscripts",
    cards: [
      { key: "books",  label: "Books",  path: "books",  description: "Series structure and book-level production status.", cta: "Open Books",  icon: "📖" },
      { key: "scenes", label: "Scenes", path: "scenes", description: "Scene-level planning with mentions and anchors.",    cta: "Open Scenes", icon: "¶" },
    ],
  },
  {
    key: "intelligence",
    label: "Intelligence",
    cards: [
      { key: "suggestions", label: "Suggestions",      path: "suggestions",       description: "Review queue for proposed canon changes.",               cta: "Review Suggestions", icon: "✦" },
      { key: "continuity",  label: "Continuity Issues", path: "continuity-issues", description: "Deterministic checks, triage, and resolution workflow.", cta: "Review Issues",      icon: "⚠" },
      { key: "change-log",  label: "Change Log",        path: "change-log",        description: "Revision trail and canon history snapshots.",            cta: "Open Log",           icon: "🧾" },
    ],
  },
];
