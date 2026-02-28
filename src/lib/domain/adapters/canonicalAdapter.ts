import type { Entry, EntryPatch, Relationship } from "@/lib/types";
import { ensureEntryCompatibilityFields } from "@/lib/domain/mappers";

/**
 * Adapter that keeps existing Plan-001 call-sites functional while the app
 * progressively migrates to Entry-first repositories.
 */
export function canonicalDocToEntry(doc: Entry): Entry {
  return ensureEntryCompatibilityFields(doc);
}

export function entryToCanonicalDoc(entry: Entry): Entry {
  return ensureEntryCompatibilityFields(entry);
}

export function relationshipToRelation(rel: Relationship): Relationship {
  return {
    ...rel,
    fromEntryId: rel.fromEntryId ?? rel.from,
    toEntryId: rel.toEntryId ?? rel.to,
    relationType: rel.relationType ?? rel.type,
    meta: rel.meta ?? rel.metadata,
  };
}

export function relationToRelationship(rel: Relationship): Relationship {
  return {
    ...rel,
    from: rel.from,
    to: rel.to,
    type: rel.type,
    metadata: rel.metadata ?? rel.meta ?? {},
  };
}

export function canonicalPatchToEntryPatch(patch: EntryPatch): EntryPatch {
  return patch;
}

export function entryPatchToCanonicalPatch(patch: EntryPatch): EntryPatch {
  return patch;
}
