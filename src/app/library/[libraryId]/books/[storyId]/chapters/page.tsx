"use client";

import { useParams, useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useRAGContext } from "@/lib/context/RAGContext";

export default function StoryChaptersPage() {
  const params = useParams<{ libraryId: string; storyId: string }>();
  const { libraryId, storyId } = params;
  const lib = useLibraryContext();
  const { ragNodes, addNode } = useRAGContext();
  const router = useRouter();

  const story = lib.stories.find((s) => s.id === storyId);

  // Chapters whose parentId === storyId
  const chapters = Object.values(ragNodes)
    .filter((n) => n.parentId === storyId && (n.type === "chapter" || n.type === "scene"))
    .sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

  const handleNewChapter = () => {
    const id = addNode(storyId, "chapter");
    router.push(`/library/${libraryId}/books/${storyId}/chapters/${id}`);
  };

  return (
    <div className="library-page">
      <div className="library-page-header">
        <div>
          <button
            className="library-page-action"
            style={{ marginBottom: 4, fontSize: 11 }}
            onClick={() => router.push(`/library/${libraryId}/books/${storyId}`)}
          >
            ← {story?.title ?? "Story"}
          </button>
          <h2>Chapters</h2>
        </div>
        <button className="library-page-action" onClick={handleNewChapter}>
          + New Chapter
        </button>
      </div>

      {chapters.length === 0 ? (
        <div className="library-page-empty">
          <p>No chapters yet.</p>
          <button className="library-page-action primary" onClick={handleNewChapter}>
            Write the first chapter
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {chapters.map((ch, i) => (
            <li key={ch.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() =>
                  router.push(`/library/${libraryId}/books/${storyId}/chapters/${ch.id}`)
                }
              >
                <span className="library-item-icon" style={{ color: "var(--text-muted)", minWidth: 20 }}>
                  {i + 1}.
                </span>
                <span className="library-item-info">
                  <span className="library-item-title">{ch.title || "Untitled Chapter"}</span>
                  {ch.content && (
                    <span className="library-item-preview">
                      {ch.content.slice(0, 80)}
                    </span>
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
