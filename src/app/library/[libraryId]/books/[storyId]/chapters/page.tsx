"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import type { Chapter } from "@/lib/types";

export default function StoryChaptersPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const store = useStore();
  const router = useRouter();

  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const rows = await store.listChaptersByBook(storyId);
      if (!cancelled) {
        setChapters([...rows].sort((a, b) => a.number - b.number));
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [store, storyId]);

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
    return (
      <div className="library-page">
        <div className="library-page-empty"><p>Loading…</p></div>
      </div>
    );
  }

  return (
    <div className="library-page">
      <div className="library-page-header">
        <div>
          <button
            className="library-page-action"
            style={{ marginBottom: 4, fontSize: 11 }}
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}`)}
          >
            ← Book
          </button>
          <h2>Chapters</h2>
        </div>
        <button className="library-page-action" onClick={() => void handleNewChapter()}>
          + New Chapter
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="library-page-empty">
          <p>No chapters yet.</p>
          <button className="library-page-action primary" onClick={() => void handleNewChapter()}>
            Write the first chapter
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {chapters.map((ch) => (
            <li key={ch.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() =>
                  router.push(`/library/${libraryId}/books/${storyId}/chapters/${ch.id}`)
                }
              >
                <span className="library-item-icon" style={{ color: "var(--text-muted)", minWidth: 20 }}>
                  {ch.number}.
                </span>
                <span className="library-item-info">
                  <span className="library-item-title">{ch.title || `Chapter ${ch.number}`}</span>
                  {ch.summary && (
                    <span className="library-item-preview">{ch.summary.slice(0, 80)}</span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

