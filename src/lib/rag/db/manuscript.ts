import type {
  PersistedBook,
  PersistedChapter,
  PersistedCharacter,
  PersistedLibraryMeta,
  PersistedLocation,
  PersistedScene,
  PersistedSeries,
  PersistedStory,
  PersistedUniverse,
  PersistedWorldEntry,
} from "@/lib/rag/store";
import type { ManuscriptStore } from "@/lib/rag/store/ManuscriptStore";
import type { QuillDB } from "./schema";
import { libraryMetaKey } from "./schema";

export function createManuscriptStore(db: QuillDB): ManuscriptStore {
  return {
    // ------------------------------------------------------------------
    // Universe
    // ------------------------------------------------------------------
    async putUniverse(universe: PersistedUniverse): Promise<void> {
      await db.put("universes", { ...universe, updatedAt: universe.updatedAt ?? Date.now() });
    },
    async getUniverse(id: string): Promise<PersistedUniverse | null> {
      const record = await db.get("universes", id);
      return record ?? null;
    },
    async listUniverses(): Promise<PersistedUniverse[]> {
      const all = await db.getAllFromIndex("universes", "by_updated");
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    // ------------------------------------------------------------------
    // Series
    // ------------------------------------------------------------------
    async putSeries(entry: PersistedSeries): Promise<void> {
      await db.put("series", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async listSeriesByUniverse(universeId: string): Promise<PersistedSeries[]> {
      const all = await db.getAllFromIndex("series", "by_universe", universeId);
      return all.sort((a, b) => a.orderIndex - b.orderIndex);
    },

    // ------------------------------------------------------------------
    // Books
    // ------------------------------------------------------------------
    async putBook(entry: PersistedBook): Promise<void> {
      await db.put("books", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async listBooksBySeries(seriesId: string): Promise<PersistedBook[]> {
      const all = await db.getAllFromIndex("books", "by_series", seriesId);
      return all.sort((a, b) => a.orderIndex - b.orderIndex);
    },
    async listBooksByUniverse(universeId: string): Promise<PersistedBook[]> {
      const all = await db.getAllFromIndex("books", "by_universe", universeId);
      return all.sort((a, b) => a.orderIndex - b.orderIndex);
    },

    // ------------------------------------------------------------------
    // Chapters
    // ------------------------------------------------------------------
    async putChapter(entry: PersistedChapter): Promise<void> {
      await db.put("chapters", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async listChaptersByBook(bookId: string): Promise<PersistedChapter[]> {
      const all = await db.getAllFromIndex("chapters", "by_book", bookId);
      return all.sort((a, b) => a.number - b.number);
    },

    // ------------------------------------------------------------------
    // Scenes
    // ------------------------------------------------------------------
    async putScene(entry: PersistedScene): Promise<void> {
      await db.put("scenes", { ...entry, updatedAt: entry.updatedAt ?? Date.now() });
    },
    async listScenesByChapter(chapterId: string): Promise<PersistedScene[]> {
      const all = await db.getAllFromIndex("scenes", "by_chapter", chapterId);
      return all.sort((a, b) => a.number - b.number);
    },
    async getSceneById(id: string): Promise<PersistedScene | undefined> {
      return db.get("scenes", id);
    },

    // ------------------------------------------------------------------
    // Library metadata (stored in the `metadata` KV store)
    // ------------------------------------------------------------------
    async putLibraryMeta(entry: PersistedLibraryMeta): Promise<void> {
      await db.put("metadata", {
        key: libraryMetaKey(entry.libraryId),
        value: entry,
        updatedAt: entry.updatedAt,
      });
    },
    async getLibraryMeta(libraryId: string): Promise<PersistedLibraryMeta | null> {
      const record = await db.get("metadata", libraryMetaKey(libraryId));
      return record ? (record.value as PersistedLibraryMeta) : null;
    },
    async deleteLibraryMeta(libraryId: string): Promise<void> {
      await db.delete("metadata", libraryMetaKey(libraryId));
    },

    // ------------------------------------------------------------------
    // Stories (legacy pre-Plan-002 manuscript model)
    // ------------------------------------------------------------------
    async putStory(entry: PersistedStory): Promise<void> {
      await db.put("stories", entry);
    },
    async getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]> {
      const all = await db.getAllFromIndex("stories", "by_library", libraryId);
      return all.sort((a, b) => a.createdAt - b.createdAt);
    },
    async getStory(id: string): Promise<PersistedStory | null> {
      const record = await db.get("stories", id);
      return record ?? null;
    },
    async deleteStory(id: string): Promise<void> {
      await db.delete("stories", id);
    },

    // ------------------------------------------------------------------
    // Legacy character store
    // ------------------------------------------------------------------
    async putCharacter(entry: PersistedCharacter): Promise<void> {
      await db.put("characters", entry);
    },
    async getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]> {
      return db.getAllFromIndex("characters", "by_library", libraryId);
    },
    async deleteCharacter(id: string): Promise<void> {
      await db.delete("characters", id);
    },

    // ------------------------------------------------------------------
    // Legacy location store
    // ------------------------------------------------------------------
    async putLocation(entry: PersistedLocation): Promise<void> {
      await db.put("locations", entry);
    },
    async getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]> {
      return db.getAllFromIndex("locations", "by_library", libraryId);
    },
    async deleteLocation(id: string): Promise<void> {
      await db.delete("locations", id);
    },

    // ------------------------------------------------------------------
    // Legacy world-entry store
    // ------------------------------------------------------------------
    async putWorldEntry(entry: PersistedWorldEntry): Promise<void> {
      await db.put("worldEntries", entry);
    },
    async getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]> {
      return db.getAllFromIndex("worldEntries", "by_library", libraryId);
    },
    async deleteWorldEntry(id: string): Promise<void> {
      await db.delete("worldEntries", id);
    },
  };
}
