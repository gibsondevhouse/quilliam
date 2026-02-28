import type {
  CharacterEntry,
  Entry,
  EntryType,
  LocationEntry,
  WorldEntry,
} from "@/lib/types";
import { createEntryRecord, makeSlug } from "@/lib/domain/types";

export function mapLegacyCharacterToEntry(character: CharacterEntry, universeId: string): Entry {
  return createEntryRecord({
    id: `char_${character.id}`,
    universeId,
    entryType: "character",
    name: character.name || "Unnamed Character",
    summary: character.role,
    bodyMd: character.notes,
    details: { legacyId: character.id, role: character.role, libraryId: character.libraryId },
  });
}

export function mapLegacyLocationToEntry(location: LocationEntry, universeId: string): Entry {
  return createEntryRecord({
    id: `loc_${location.id}`,
    universeId,
    entryType: "location",
    name: location.name || "Unnamed Location",
    summary: location.description,
    bodyMd: location.description,
    details: { legacyId: location.id, libraryId: location.libraryId },
  });
}

export function mapLegacyWorldEntryToEntry(world: WorldEntry, universeId: string): Entry {
  return createEntryRecord({
    id: `lre_${world.id}`,
    universeId,
    entryType: "lore_entry",
    name: world.title || "Untitled",
    summary: world.category,
    bodyMd: world.notes,
    details: { legacyId: world.id, category: world.category, libraryId: world.libraryId },
  });
}

export function ensureEntryCompatibilityFields(entry: Entry): Entry {
  const status = entry.canonStatus === "canon" ? "canon" : "draft";
  return {
    ...entry,
    type: entry.entryType,
    status,
    slug: entry.slug || makeSlug(entry.name || entry.id),
    details: entry.details ?? {},
    sources: entry.sources ?? [],
    relationships: entry.relationships ?? [],
    lastVerified: entry.lastVerified ?? 0,
  };
}

export function mapEntryTypeToLegacyPrefix(type: EntryType): string {
  switch (type) {
    case "character":
      return "char";
    case "location":
      return "loc";
    case "culture":
      return "cul";
    case "organization":
    case "faction":
      return "org";
    case "system":
    case "magic_system":
      return "sys";
    case "item":
      return "itm";
    case "language":
      return "lng";
    case "religion":
      return "rel";
    case "lineage":
      return "lin";
    case "economy":
      return "eco";
    case "rule":
      return "rul";
    case "lore_entry":
      return "lre";
    case "scene":
      return "scn";
    case "timeline_event":
      return "evt";
    default:
      return "ent";
  }
}
