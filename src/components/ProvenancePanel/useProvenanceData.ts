import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { Book, Chapter, Entry, Scene, SourceRef } from "@/lib/types";

export interface ResolvedMention {
  sceneId: string;
  scene: Scene | null;
  chapter: Chapter | null;
  book: Book | null;
}

export function useProvenanceData(entry: Entry | null) {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const [mentions, setMentions] = useState<ResolvedMention[]>([]);
  const [loading, setLoading] = useState(false);
  const loadedRef = useRef<string | null>(null);

  const load = useCallback(async (e: Entry) => {
    setLoading(true);

    // Build chapter/book lookup maps once
    const books = await store.listBooksByUniverse(libraryId);
    const bookMap = new Map<string, Book>(books.map((b) => [b.id, b]));

    const allChapters: Chapter[] = (
      await Promise.all(books.map((b) => store.listChaptersByBook(b.id)))
    ).flat();
    const chapterMap = new Map<string, Chapter>(allChapters.map((c) => [c.id, c]));

    // Load scene mentions
    const rawMentions = await store.listMentionsByEntry(e.id);

    const resolved: ResolvedMention[] = await Promise.all(
      rawMentions.map(async (m) => {
        const scene = (await store.getSceneById(m.sceneId)) ?? null;
        const chapter = scene ? (chapterMap.get(scene.chapterId) ?? null) : null;
        const book = chapter ? (bookMap.get(chapter.bookId) ?? null) : null;
        return { sceneId: m.sceneId, scene, chapter, book };
      }),
    );

    setMentions(resolved.sort((a, b) => {
      const bookA = a.book?.orderIndex ?? 999;
      const bookB = b.book?.orderIndex ?? 999;
      if (bookA !== bookB) return bookA - bookB;
      return (a.chapter?.number ?? 0) - (b.chapter?.number ?? 0);
    }));
    setLoading(false);
  }, [store, libraryId]);

  useEffect(() => {
    if (!entry) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMentions([]);
      return;
    }
    if (loadedRef.current === entry.id) return;
    loadedRef.current = entry.id;
    void load(entry);
  }, [entry, load]);

  const addManualSource = useCallback(async (excerpt: string): Promise<void> => {
    if (!entry) return;
    const newRef: SourceRef = {
      kind: "manual",
      id: crypto.randomUUID(),
      excerpt: excerpt.trim() || undefined,
    };
    const updated = [...(entry.sources ?? []), newRef];
    await store.updateEntry(entry.id, { sources: updated });
  }, [store, entry]);

  const removeSource = useCallback(async (sourceId: string): Promise<void> => {
    if (!entry) return;
    const updated = (entry.sources ?? []).filter((s) => s.id !== sourceId);
    await store.updateEntry(entry.id, { sources: updated });
  }, [store, entry]);

  const refresh = useCallback(() => {
    loadedRef.current = null;
    if (entry) void load(entry);
  }, [entry, load]);

  return { mentions, loading, addManualSource, removeSource, refresh };
}
