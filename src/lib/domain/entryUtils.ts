/**
 * Shared entry-domain utilities.
 * Provides the canonical TYPE_PREFIX map, slug-based entry ID generator,
 * and route-path resolver used across dashboard and map components.
 */
import type { EntryType } from "@/lib/types";

/** Short prefix for each entry type, used to construct stable IDs. */
export const TYPE_PREFIX: Record<EntryType, string> = {
  character: "char",
  location: "loc",
  culture: "cul",
  organization: "org",
  system: "sys",
  item: "itm",
  language: "lng",
  religion: "rel",
  lineage: "lin",
  economy: "eco",
  rule: "rul",
  // Legacy/transitional
  faction: "fac",
  magic_system: "mgc",
  lore_entry: "lre",
  scene: "scn",
  timeline_event: "evt",
};

/**
 * Derive a stable slug-based entry ID from type + name.
 * @example makeEntryId("character", "Elara Voss") → "char_elara_voss"
 */
export function makeEntryId(type: EntryType, name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `${TYPE_PREFIX[type] ?? "ent"}_${slug}`;
}

/**
 * Map an entry type to its library route path segment.
 * @example pathForEntryType("character") → "characters"
 */
export function pathForEntryType(entryType: EntryType): string {
  switch (entryType) {
    case "character":      return "characters";
    case "location":       return "locations";
    case "culture":        return "cultures";
    case "organization":   return "organizations";
    case "faction":        return "factions";
    case "system":
    case "magic_system":   return "magic-systems";
    case "item":           return "items";
    case "language":       return "languages";
    case "religion":       return "religions";
    case "lineage":        return "lineages";
    case "economy":        return "economics";
    case "rule":           return "rules";
    case "scene":          return "scenes";
    case "timeline_event": return "master-timeline";
    case "lore_entry":     return "cosmology";
    default:               return "universe";
  }
}
