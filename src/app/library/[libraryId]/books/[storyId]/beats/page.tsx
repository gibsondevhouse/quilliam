"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/context/useStore";
import type { Book, Chapter, Scene } from "@/lib/types";

type PersistedBook = Book;
type PersistedChapter = Chapter;
type PersistedScene = Scene;

interface ChapterWithScenes {
  chapter: PersistedChapter;
  scenes: PersistedScene[];
}

interface SceneDraft {
  sceneMd: string;
}

const BLANK_SCENE: SceneDraft = { sceneMd: "" };

export default function BookBeatsPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const store = useStore();
  const router = useRouter();

  const [book, setBook] = useState<PersistedBook | null>(null);
  const [chapters, setChapters] = useState<ChapterWithScenes[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedChapters, setExpandedChapters] = useState<Set<string>>(new Set());
  const [addingSceneTo, setAddingSceneTo] = useState<string | null>(null);
  const [sceneDraft, setSceneDraft] = useState<SceneDraft>(BLANK_SCENE);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const books = await store.listBooksByUniverse(libraryId);
    const found = books.find((b) => b.id === storyId) ?? null;
    setBook(found);

    const rawChapters = await store.listChaptersByBook(storyId);
    const sorted = [...rawChapters].sort((a, b) => a.number - b.number);

    const withScenes: ChapterWithScenes[] = await Promise.all(
      sorted.map(async (ch) => {
        const scenes = await store.listScenesByChapter(ch.id);
        return {
          chapter: ch,
          scenes: [...scenes].sort((a, b) => a.number - b.number),
        };
      }),
    );

    setChapters(withScenes);
    setExpandedChapters((prev) => {
      if (prev.size === 0 && withScenes.length > 0) {
        return new Set([withScenes[0].chapter.id]);
      }
      return prev;
    });
    setLoading(false);
  }, [store, libraryId, storyId]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
  }, [reload]);

  const toggleChapter = useCallback((id: string) => {
    setExpandedChapters((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleAddScene = useCallback(
    async (chapterId: string) => {
      if (!sceneDraft.sceneMd.trim()) return;
      setSaving(true);
      const chEntry = chapters.find((c) => c.chapter.id === chapterId);
      const nextNum = (chEntry?.scenes.length ?? 0) + 1;
      const now = Date.now();
      const newScene: PersistedScene = {
        id: crypto.randomUUID(),
        chapterId,
        number: nextNum,
        sceneMd: sceneDraft.sceneMd.trim(),
        createdAt: now,
        updatedAt: now,
      };
      await store.putScene(newScene);
      setSceneDraft(BLANK_SCENE);
      setAddingSceneTo(null);
      setSaving(false);
      loadedRef.current = false;
      void reload();
    },
    [store, chapters, sceneDraft, reload],
  );

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
            ← {book?.title ?? "Book"}
          </button>
          <h2>Beats &amp; Outline</h2>
        </div>
      </div>

      {chapters.length === 0 ? (
        <div className="library-page-empty">
          <p>No chapters yet. Add chapters from the Book page first.</p>
          <button
            className="library-page-action primary"
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}`)}
          >
            Go to Book
          </button>
        </div>
      ) : (
        <div className="beats-outline">
          {chapters.map(({ chapter, scenes }) => (
            <div key={chapter.id} className="beats-chapter">
              <button
                className="beats-chapter-header"
                onClick={() => toggleChapter(chapter.id)}
              >
                <span className="beats-chapter-num">Ch. {chapter.number}</span>
                <span className="beats-chapter-title">
                  {chapter.title || "Untitled Chapter"}
                </span>
                <span className="beats-chapter-count">
                  {scenes.length} scene{scenes.length !== 1 ? "s" : ""}
                </span>
                <span className="beats-chapter-toggle">
                  {expandedChapters.has(chapter.id) ? "▾" : "▸"}
                </span>
              </button>

              {expandedChapters.has(chapter.id) && (
                <div className="beats-scenes">
                  {chapter.summary && (
                    <p className="beats-chapter-summary">{chapter.summary}</p>
                  )}

                  {scenes.length === 0 && (
                    <p className="beats-empty">No scenes in this chapter yet.</p>
                  )}

                  {scenes.map((scene) => (
                    <div key={scene.id} className="beats-scene-card">
                      <span className="beats-scene-num">Scene {scene.number}</span>
                      <p className="beats-scene-preview">
                        {scene.sceneMd.slice(0, 160)}
                        {scene.sceneMd.length > 160 ? "…" : ""}
                      </p>
                    </div>
                  ))}

                  {addingSceneTo === chapter.id ? (
                    <div className="beats-add-scene cv-form">
                      <div className="cv-form-row">
                        <label className="cv-form-label">Scene beat / summary</label>
                        <textarea
                          className="cv-form-textarea"
                          rows={3}
                          placeholder="What happens in this scene? A brief beat or full prose."
                          value={sceneDraft.sceneMd}
                          onChange={(e) => setSceneDraft({ sceneMd: e.target.value })}
                        />
                      </div>
                      <div className="cv-form-actions">
                        <button
                          className="cv-form-btn cv-form-btn--primary"
                          onClick={() => void handleAddScene(chapter.id)}
                          disabled={saving || !sceneDraft.sceneMd.trim()}
                        >
                          {saving ? "Saving…" : "Add Scene"}
                        </button>
                        <button
                          className="cv-form-btn"
                          onClick={() => {
                            setAddingSceneTo(null);
                            setSceneDraft(BLANK_SCENE);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="beats-add-btn"
                      onClick={() => {
                        setAddingSceneTo(chapter.id);
                        setSceneDraft(BLANK_SCENE);
                      }}
                    >
                      + Add Scene
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
