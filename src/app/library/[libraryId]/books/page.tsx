"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useStore } from "@/lib/context/useStore";
import type { Book } from "@/lib/types";

const STATUS_COLORS: Record<string, string> = {
  idea: "#6b7280",
  planning: "#8b5cf6",
  drafting: "#3b82f6",
  editing: "#f59e0b",
  published: "#22c55e",
  archived: "#4b5563",
};

export default function BooksPage() {
  const params = useParams<{ libraryId: string }>();
  const libraryId = params.libraryId;
  const store = useStore();
  const lib = useLibraryContext();
  const router = useRouter();

  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await store.listBooksByUniverse(libraryId);
      if (!cancelled) {
        setBooks(rows);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [store, libraryId]);

  const handleNewBook = useCallback(() => {
    const story = lib.addStory();
    // addStory dual-writes to the books IDB store; navigate immediately
    router.push(`/library/${libraryId}/books/${story.id}`);
  }, [lib, libraryId, router]);

  const handleDelete = useCallback(async (id: string) => {
    // Remove from both Plan-002 books store and legacy stories store
    await store.deleteBook(id);
    lib.deleteStory(id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }, [store, lib]);

  if (loading) {
    return (
      <div className="library-page">
        <div className="library-page-empty"><p>Loading…</p></div>
      </div>
    );
  }

  return (
    <div className="library-page">
      <div className="library-page-header">
        <h2>Books</h2>
        <button className="library-page-action" onClick={handleNewBook}>+ New Book</button>
      </div>

      {books.length === 0 ? (
        <div className="library-page-empty">
          <p>No books yet.</p>
          <button className="library-page-action primary" onClick={handleNewBook}>
            Create your first book
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {books.map((b) => (
            <li key={b.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() => router.push(`/library/${libraryId}/books/${b.id}`)}
              >
                <span className="library-item-icon">📚</span>
                <span className="library-item-info">
                  <span className="library-item-title">{b.title}</span>
                </span>
                <span
                  className="library-item-category"
                  style={{ color: STATUS_COLORS[b.status] ?? "#6b7280" }}
                >
                  {b.status}
                </span>
              </button>
              <button
                className="library-item-delete"
                onClick={(e) => { e.stopPropagation(); void handleDelete(b.id); }}
                title="Delete book"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
