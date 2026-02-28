import type {
  CanonStatus,
  CultureVersion,
  Entry,
  EntryType,
  VisibilityScope,
} from "@/lib/types";
import { isCanonStatus, isEntryType, isVisibilityScope } from "@/lib/domain/enums";

export interface EntryCreateInput {
  universeId: string;
  entryType: EntryType;
  name: string;
  summary?: string;
  bodyMd?: string;
  canonStatus?: CanonStatus;
  visibility?: VisibilityScope;
  tags?: string[];
  aliases?: string[];
  details?: Record<string, unknown>;
}

export interface EntryUpdateInput {
  id: string;
  name?: string;
  summary?: string;
  bodyMd?: string;
  canonStatus?: CanonStatus;
  visibility?: VisibilityScope;
  tags?: string[];
  aliases?: string[];
  details?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function makeSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function validateEntry(input: Partial<Entry>): ValidationResult {
  const errors: string[] = [];

  if (!input.universeId || input.universeId.trim().length === 0) {
    errors.push("universeId is required");
  }

  if (!input.entryType || !isEntryType(input.entryType)) {
    errors.push(`entryType is invalid: ${String(input.entryType)}`);
  }

  if (!input.name || input.name.trim().length === 0) {
    errors.push("name is required");
  }

  if (input.canonStatus && !isCanonStatus(input.canonStatus)) {
    errors.push(`canonStatus is invalid: ${String(input.canonStatus)}`);
  }

  if (input.visibility && !isVisibilityScope(input.visibility)) {
    errors.push(`visibility is invalid: ${String(input.visibility)}`);
  }

  return { valid: errors.length === 0, errors };
}

export function createEntryRecord(input: EntryCreateInput & { id: string; now?: number }): Entry {
  const now = input.now ?? Date.now();
  const slug = makeSlug(input.name || input.id);
  const canonStatus = input.canonStatus ?? "draft";
  const status = canonStatus === "canon" ? "canon" : "draft";

  return {
    id: input.id,
    universeId: input.universeId,
    entryType: input.entryType,
    name: input.name,
    slug,
    summary: input.summary ?? "",
    bodyMd: input.bodyMd ?? "",
    canonStatus,
    visibility: input.visibility ?? "private",
    tags: input.tags ?? [],
    aliases: input.aliases ?? [],
    coverMediaId: undefined,
    type: input.entryType,
    details: input.details ?? {},
    status,
    sources: [],
    relationships: [],
    lastVerified: 0,
    createdAt: now,
    updatedAt: now,
  };
}

export function applyEntryUpdate(entry: Entry, patch: EntryUpdateInput, now = Date.now()): Entry {
  const canonStatus = patch.canonStatus ?? entry.canonStatus;
  const status = canonStatus === "canon" ? "canon" : "draft";

  return {
    ...entry,
    name: patch.name ?? entry.name,
    slug: patch.name ? makeSlug(patch.name) : entry.slug,
    summary: patch.summary ?? entry.summary,
    bodyMd: patch.bodyMd ?? entry.bodyMd,
    canonStatus,
    visibility: patch.visibility ?? entry.visibility,
    tags: patch.tags ?? entry.tags,
    aliases: patch.aliases ?? entry.aliases,
    details: patch.details ?? entry.details,
    status,
    updatedAt: now,
  };
}

export function isCultureVersionActive(version: CultureVersion, eventId: string): boolean {
  if (version.validFromEventId === eventId) return true;
  return version.validToEventId === undefined;
}
