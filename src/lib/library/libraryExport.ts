/**
 * Library JSON export — dumps the entire library to a downloadable JSON file.
 *
 * Content sources (in priority order for chapter prose):
 *   1. Yjs CRDT IndexeddbPersistence (`quilliam-yjs-<chapterId>`) — authoritative
 *      for chapters that have ever been opened in this browser.
 *   2. RAG `nodes` IDB store — fallback for legacy RAG-node-based chapters.
 *
 * The export is self-contained and can be used for backup or future import.
 */

import type { RAGStore } from "@/lib/rag/store";
import { getYjsDoc, YJS_TEXT_KEY } from "@/lib/yjs/yjsDoc";

interface ChapterExport {
  id: string;
  bookId: string;
  number: number;
  title: string;
  summary?: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

interface BookExport {
  id: string;
  title: string;
  status: string;
  orderIndex: number;
  createdAt: number;
  updatedAt: number;
  chapters: ChapterExport[];
}

export interface LibraryExport {
  exportVersion: 1;
  exportedAt: number;
  libraryId: string;
  libraryTitle: string;
  universe: {
    id: string;
    name: string;
    tagline?: string;
    overviewMd?: string;
  } | null;
  books: BookExport[];
  entries: unknown[];
  chatSessions: unknown[];
}

/** Read chapter prose from the Yjs CRDT store, with a 3 s timeout. */
async function fetchYjsContent(chapterId: string): Promise<string | null> {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), 3000);
    try {
      const { doc, provider } = getYjsDoc(chapterId);
      void provider.whenSynced.then(() => {
        clearTimeout(timeoutId);
        const text = doc.getText(YJS_TEXT_KEY).toString();
        resolve(text || null);
      });
    } catch {
      clearTimeout(timeoutId);
      resolve(null);
    }
  });
}

export async function exportLibraryToJSON(
  libraryId: string,
  store: RAGStore,
): Promise<LibraryExport> {
  const [
    libraryMeta,
    universe,
    books,
    entries,
    chatSessions,
  ] = await Promise.all([
    store.getLibraryMeta(libraryId),
    store.getUniverse(libraryId),
    store.listBooksByUniverse(libraryId),
    store.listEntriesByUniverse(libraryId),
    store.listChatSessionsByLibrary(libraryId),
  ]);

  const bookExports: BookExport[] = await Promise.all(
    books.map(async (book) => {
      const chapters = await store.listChaptersByBook(book.id);
      const chapterExports: ChapterExport[] = await Promise.all(
        chapters.map(async (ch) => {
          // Try Yjs first, then RAG node fallback
          let content = await fetchYjsContent(ch.id);
          if (content === null) {
            const node = await store.getNode(ch.id);
            content = node?.content ?? "";
          }
          return {
            id: ch.id,
            bookId: ch.bookId,
            number: ch.number,
            title: ch.title,
            summary: ch.summary,
            content,
            createdAt: ch.createdAt,
            updatedAt: ch.updatedAt,
          };
        }),
      );

      return {
        id: book.id,
        title: book.title,
        status: book.status,
        orderIndex: book.orderIndex,
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        chapters: chapterExports.sort((a, b) => a.number - b.number),
      };
    }),
  );

  return {
    exportVersion: 1,
    exportedAt: Date.now(),
    libraryId,
    libraryTitle: libraryMeta?.title ?? universe?.name ?? libraryId,
    universe: universe
      ? {
          id: universe.id,
          name: universe.name,
          tagline: universe.tagline,
          overviewMd: universe.overviewMd,
        }
      : null,
    books: bookExports.sort((a, b) => a.orderIndex - b.orderIndex),
    entries,
    chatSessions,
  };
}

/** Trigger a browser download of the library as a JSON file. */
export function downloadLibraryJSON(data: LibraryExport): void {
  const filename = `quilliam-${data.libraryTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date(data.exportedAt).toISOString().slice(0, 10)}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
