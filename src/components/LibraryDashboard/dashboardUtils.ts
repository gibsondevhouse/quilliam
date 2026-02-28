/**
 * LibraryDashboard — pure utility functions.
 */
import type { Entry, EntryType } from "@/lib/types";

export function formatLastUpdated(ts?: number): string {
  if (!ts) return "No updates";
  const deltaMs = Date.now() - ts;
  const mins = Math.floor(deltaMs / 60_000);
  if (mins < 1) return "Updated just now";
  if (mins < 60) return `Updated ${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days}d ago`;
}

export function newest(rows: Array<{ updatedAt: number }>): number | undefined {
  return rows.length > 0 ? Math.max(...rows.map((r) => r.updatedAt)) : undefined;
}

export function moduleKeysForEntryType(entryType: EntryType): string[] {
  switch (entryType) {
    case "character":      return ["characters", "relationship-web"];
    case "location":       return ["locations"];
    case "culture":        return ["cultures"];
    case "organization":   return ["organizations", "conflicts"];
    case "faction":        return ["factions", "conflicts"];
    case "system":
    case "magic_system":   return ["systems"];
    case "item":           return ["items"];
    case "language":       return ["languages"];
    case "religion":       return ["religions"];
    case "lineage":        return ["lineages", "relationship-web"];
    case "economy":        return ["economics"];
    case "rule":           return ["rules", "laws"];
    case "scene":          return ["scenes"];
    case "timeline_event": return ["timeline", "conflicts"];
    case "lore_entry":     return ["cosmology", "overview"];
    default:               return [];
  }
}

export function buildIssueHeatmap(
  issues: Array<{ checkType: string; evidence: Array<{ type: string; id: string }> }>,
  entries: Entry[],
): Record<string, number> {
  const heat: Record<string, number> = {};
  const byId = new Map(entries.map((e) => [e.id, e] as const));

  const bump = (key: string) => { heat[key] = (heat[key] ?? 0) + 1; };

  for (const issue of issues) {
    const keys = new Set<string>();
    for (const ev of issue.evidence) {
      if (ev.type !== "entry" && ev.type !== "event" && ev.type !== "scene") continue;
      const entry = byId.get(ev.id);
      if (entry) {
        for (const key of moduleKeysForEntryType(entry.entryType)) keys.add(key);
      } else if (ev.type === "event") {
        keys.add("timeline");
      } else if (ev.type === "scene") {
        keys.add("scenes");
      }
    }

    if (issue.checkType.includes("timeline") || issue.checkType.includes("death")) keys.add("timeline");
    if (issue.checkType.includes("culture")) { keys.add("cultures"); keys.add("characters"); }
    if (issue.checkType.includes("mention")) keys.add("scenes");

    if (keys.size === 0) keys.add("continuity");
    keys.add("continuity");
    for (const key of keys) bump(key);
  }

  return heat;
}
