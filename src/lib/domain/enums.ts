import type { CanonStatus, EntryType, VisibilityScope } from "@/lib/types";

export const ENTRY_TYPES: EntryType[] = [
  "character",
  "location",
  "culture",
  "organization",
  "system",
  "item",
  "language",
  "religion",
  "lineage",
  "economy",
  "rule",
  // Transitional legacy values retained while migration runs.
  "faction",
  "magic_system",
  "lore_entry",
  "scene",
  "timeline_event",
];

export const CANON_STATUSES: CanonStatus[] = [
  "draft",
  "proposed",
  "canon",
  "deprecated",
  "retconned",
  "alternate-branch",
];

export const VISIBILITY_SCOPES: VisibilityScope[] = ["private", "team", "public"];

export function isEntryType(value: string): value is EntryType {
  return ENTRY_TYPES.includes(value as EntryType);
}

export function isCanonStatus(value: string): value is CanonStatus {
  return CANON_STATUSES.includes(value as CanonStatus);
}

export function isVisibilityScope(value: string): value is VisibilityScope {
  return VISIBILITY_SCOPES.includes(value as VisibilityScope);
}
