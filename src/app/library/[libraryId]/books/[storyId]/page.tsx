"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import type { Book, BookStatus, Chapter } from "@/lib/types";

const STATUS_CYCLE: BookStatus[] = ["idea", "planning", "drafting", "editing", "published", "archived"];
const STATUS_COLORS: Record<BookStatus, string> = {
  idea: "#6b7280",
  planning: "#8b5cf6",
  drafting: "#3b82f6",
  editing: "#f59e0b",
  published: "#22c55e",
  archived: "#4b5563",
};

export default function BookDashboardPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const store = useStore();
  const router = useRouter();

  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const books = await store.listBooksByUniverse(libraryId);
    const found = books.find((b) => b.id === storyId) ?? null;
    setBook(found);
    if (found) setTitleDraft(found.title);
    const chs = await store.listChaptersByBook(storyId);
    setChapters([...chs].sort((a, b) => a.number - b.number));
    setLoading(false);
  }, [store, libraryId, storyId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const commitTitle = useCallback(async () => {
    setEditingTitle(false);
    if (!book || !titleDraft.trim() || titleDraft.trim() === book.title) return;
    const updated: Book = { ...book, title: titleDraft.trim(), updatedAt: Date.now() };
    await store.putBook(updated);
    setBook(updated);
  }, [store, book, titleDraft]);

  const cycleStatus = useCallback(async () => {
    if (!book) return;
    const next = STATUS_CYCLE[(STATUS_CYCLE.indexOf(book.status) + 1) % STATUS_CYCLE.length];
    const updated: Book = { ...book, status: next, updatedAt: Date.now() };
    await store.putBook(updated);
    setBook(updated);
  }, [store, book]);

  const handleNewChapter = useCallback(async () => {
    const nextNum = chapters.length + 1;
    const now = Date.now();
    const newChapter: Chapter = {
      id: crypto.randomUUID(),
      bookId: storyId,
      number: nextNum,
      title: `Chapter ${nextNum}`,
      createdAt: now,
      updatedAt: now,
    };
    await store.putChapter(newChapter);
    router.push(`/library/${libraryId}/books/${storyId}/chapters/${newChapter.id}`);
  }, [store, storyId, libraryId, chapters.length, router]);

  if (loading) {
    return <div className="library-page"><div className="library-page-empty"><p>Loading…</p></div></div>;
  }

  if (!book) {
    return (
      <div className="library-page-empty">
        <p>Book not found.</p>
        <button className="library-page-action" onClick={() => router.push(`/library/${libraryId}/books`)}>
          ← Back to Books
        </button>
      </div>
    );
  }

  return (
    <div className="library-dashboard">
      {/* Book header */}
      <div className="library-dashboard-header">
        <div className="library-dashboard-title-row">
          {editingTitle ? (
            <input
              className="library-dashboard-title-input"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={() => void commitTitle()}
              onKeyDown={(e) => {
                if (e.key === "Enter") void commitTitle();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <h1
              className="library-dashboard-title"
              onClick={() => { setTitleDraft(book.title); setEditingTitle(true); }}
              title="Click to edit"
            >
              {book.title}
            </h1>
          )}
          <span
            className="library-dashboard-status"
            style={{ "--status-color": STATUS_COLORS[book.status] } as React.CSSProperties}
            onClick={() => void cycleStatus()}
            title="Click to cycle status"
          >
            {book.status}
          </span>
        </div>

        <div className="library-dashboard-quick-actions">
          <button className="library-dashboard-action" onClick={() => void handleNewChapter()}>
            + New Chapter
          </button>
          <button
            className="library-dashboard-action"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}/beats`)}
          >
            Beats &amp; Outline
          </button>
          <button
            className="library-dashboard-action"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}/timeline`)}
          >
            Book Timeline
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="library-dashboard-cards">
        <div className="library-dashboard-card" style={{ gridColumn: "1 / -1" }}>
          <div className="library-dashboard-card-header">
            <h3>§ Chapters <span className="library-dashboard-count">{chapters.length}</span></h3>
            <button onClick={() => router.push(`/library/${libraryId}/books/${storyId}/chapters`)}>
              View all →
            </button>
          </div>
          {chapters.length === 0 ? (
            <p className="library-dashboard-empty">
              No chapters yet.{" "}
              <button onClick={() => void handleNewChapter()}>Write the first chapter</button>
            </p>
          ) : (
            <ul className="library-dashboard-list">
              {chapters.slice(0, 8).map((ch) => (
                <li key={ch.id}>
                  <button
                    onClick={() => router.push(`/library/${libraryId}/books/${storyId}/chapters/${ch.id}`)}
                  >
                    <span className="item-icon">§</span>
                    <span className="item-title">{ch.title || `Chapter ${ch.number}`}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Beats &amp; Outline</h3>
            <button onClick={() => router.push(`/library/${libraryId}/books/${storyId}/beats`)}>
              View →
            </button>
          </div>
          <p className="library-dashboard-empty">Plan scenes and act structure.</p>
        </div>

        <div className="library-dashboard-card">
          <div className="library-dashboard-card-header">
            <h3>Book Timeline</h3>
            <button onClick={() => router.push(`/library/${libraryId}/books/${storyId}/timeline`)}>
              View →
            </button>
          </div>
          <p className="library-dashboard-empty">Narrative events anchored to canon.</p>
        </div>
      </div>
    </div>
  );
}
