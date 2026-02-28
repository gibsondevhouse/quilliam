import type {
  CharacterEntry,
  Entry,
  LocationEntry,
  WorldEntry,
} from "@/lib/types";
import {
  mapLegacyCharacterToEntry,
  mapLegacyLocationToEntry,
  mapLegacyWorldEntryToEntry,
} from "@/lib/domain/mappers";

export interface LegacyEntityReader {
  getCharactersByLibrary(libraryId: string): Promise<Array<CharacterEntry & { updatedAt?: number }>>;
  getLocationsByLibrary(libraryId: string): Promise<Array<LocationEntry & { updatedAt?: number }>>;
  getWorldEntriesByLibrary(libraryId: string): Promise<Array<WorldEntry & { updatedAt?: number }>>;
}

export interface LegacyEntityWriteBridge {
  addEntry(entry: Entry): Promise<void>;
}

export async function readLegacyEntries(
  reader: LegacyEntityReader,
  libraryId: string,
  universeId: string,
): Promise<Entry[]> {
  const [characters, locations, worlds] = await Promise.all([
    reader.getCharactersByLibrary(libraryId),
    reader.getLocationsByLibrary(libraryId),
    reader.getWorldEntriesByLibrary(libraryId),
  ]);

  return [
    ...characters.map((c) => mapLegacyCharacterToEntry(c, universeId)),
    ...locations.map((l) => mapLegacyLocationToEntry(l, universeId)),
    ...worlds.map((w) => mapLegacyWorldEntryToEntry(w, universeId)),
  ];
}

/**
 * Freeze legacy writers: new writes should go to Entry repositories only.
 * This helper intentionally does not write back to legacy stores.
 */
export async function writeEntryThroughBridge(bridge: LegacyEntityWriteBridge, entry: Entry): Promise<void> {
  await bridge.addEntry(entry);
}
