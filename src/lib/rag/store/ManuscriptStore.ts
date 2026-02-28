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

export interface ManuscriptStore {
  // Universe
  putUniverse(universe: PersistedUniverse): Promise<void>;
  getUniverse(id: string): Promise<PersistedUniverse | null>;
  listUniverses(): Promise<PersistedUniverse[]>;
  // Series
  putSeries(entry: PersistedSeries): Promise<void>;
  listSeriesByUniverse(universeId: string): Promise<PersistedSeries[]>;
  // Books
  putBook(entry: PersistedBook): Promise<void>;
  listBooksBySeries(seriesId: string): Promise<PersistedBook[]>;
  listBooksByUniverse(universeId: string): Promise<PersistedBook[]>;
  // Chapters
  putChapter(entry: PersistedChapter): Promise<void>;
  listChaptersByBook(bookId: string): Promise<PersistedChapter[]>;
  // Scenes
  putScene(entry: PersistedScene): Promise<void>;
  listScenesByChapter(chapterId: string): Promise<PersistedScene[]>;
  getSceneById(id: string): Promise<PersistedScene | undefined>;
  // Library metadata
  putLibraryMeta(entry: PersistedLibraryMeta): Promise<void>;
  getLibraryMeta(libraryId: string): Promise<PersistedLibraryMeta | null>;
  deleteLibraryMeta(libraryId: string): Promise<void>;
  // Stories (legacy pre-Plan-002 manuscript model)
  putStory(entry: PersistedStory): Promise<void>;
  getStoriesByLibrary(libraryId: string): Promise<PersistedStory[]>;
  getStory(id: string): Promise<PersistedStory | null>;
  deleteStory(id: string): Promise<void>;
  // Legacy character/location/world-entry stores
  /** @deprecated Use `queryDocsByType("character")` instead. */
  putCharacter(entry: PersistedCharacter): Promise<void>;
  /** @deprecated Use `queryDocsByType("character")` instead. */
  getCharactersByLibrary(libraryId: string): Promise<PersistedCharacter[]>;
  /** @deprecated Use `queryDocsByType("character")` instead. */
  deleteCharacter(id: string): Promise<void>;
  /** @deprecated Use `queryDocsByType("location")` instead. */
  putLocation(entry: PersistedLocation): Promise<void>;
  /** @deprecated Use `queryDocsByType("location")` instead. */
  getLocationsByLibrary(libraryId: string): Promise<PersistedLocation[]>;
  /** @deprecated Use `queryDocsByType("location")` instead. */
  deleteLocation(id: string): Promise<void>;
  /** @deprecated Use `queryDocsByType("lore_entry")` instead. */
  putWorldEntry(entry: PersistedWorldEntry): Promise<void>;
  /** @deprecated Use `queryDocsByType("lore_entry")` instead. */
  getWorldEntriesByLibrary(libraryId: string): Promise<PersistedWorldEntry[]>;
  /** @deprecated Use `queryDocsByType("lore_entry")` instead. */
  deleteWorldEntry(id: string): Promise<void>;
}
