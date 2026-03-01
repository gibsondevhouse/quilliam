"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import type { Book, Chapter } from "@/lib/types";

interface ChapterRow {
  chapter: Chapter;
  book: Book;
}

export default function ChaptersPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const store = useStore();
  const router = useRouter();

  const [rows, setRows] = useState<ChapterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const books = await store.listBooksByUniverse(libraryId);
      const chapterGroups = await Promise.all(
        books.map(async (book) => {
          const chapters = await store.listChaptersByBook(book.id);
          return chapters.map((chapter) => ({ chapter, book }));
        }),
      );
      if (!cancelled) {
        setRows(chapterGroups.flat().sort((a, b) => a.chapter.createdAt - b.chapter.createdAt));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [store, libraryId]);

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-page-empty"><p>Loading…</p></div>
      </div>
    );
  }

  return (
    <div className="library-page chapters-page">
      <div className="library-page-header">
        <h2>Chapters</h2>
        <button
          className="library-page-action"
          onClick={() => router.push(`/library/${libraryId}/books`)}
        >
          + New Book
        </button>
      </div>
      {rows.length === 0 ? (
        <div className="library-page-empty">
          <p>No chapters yet.</p>
          <button
            className="library-page-action primary"
            onClick={() => router.push(`/library/${libraryId}/books`)}
          >
            Create a book first
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {rows.map(({ chapter, book }) => (
            <li key={chapter.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() =>
                  router.push(
                    `/library/${libraryId}/books/${book.id}/chapters/${chapter.id}`,
                  )
                }
              >
                <span className="library-item-icon" style={{ color: "var(--text-muted)", minWidth: 20 }}>
                  §
                </span>
                <span className="library-item-info">
                  <span className="library-item-title">
                    {chapter.title || `Chapter ${chapter.number}`}
                  </span>
                  <span className="library-item-preview">{book.title}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
