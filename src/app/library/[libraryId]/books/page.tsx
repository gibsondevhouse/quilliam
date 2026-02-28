"use client";

import { useRouter } from "next/navigation";
import { useLibraryContext } from "@/lib/context/LibraryContext";

const STATUS_COLORS: Record<string, string> = {
  drafting: "#3b82f6",
  editing: "#f59e0b",
  archived: "#6b7280",
};

export default function BooksPage() {
  const lib = useLibraryContext();
  const router = useRouter();

  const handleNewStory = () => {
    const story = lib.addStory();
    router.push(`/library/${lib.libraryId}/books/${story.id}`);
  };

  return (
    <div className="library-page">
      <div className="library-page-header">
        <h2>Books</h2>
        <button className="library-page-action" onClick={handleNewStory}>+ New Book</button>
      </div>

      {lib.stories.length === 0 ? (
        <div className="library-page-empty">
          <p>No books yet.</p>
          <button className="library-page-action primary" onClick={handleNewStory}>
            Create your first book
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {lib.stories.map((s) => (
            <li key={s.id} className="library-item-row">
              <button
                className="library-item-btn"
                onClick={() => router.push(`/library/${lib.libraryId}/books/${s.id}`)}
              >
                <span className="library-item-icon">📚</span>
                <span className="library-item-info">
                  <span className="library-item-title">{s.title}</span>
                  {s.synopsis && <span className="library-item-preview">{s.synopsis}</span>}
                </span>
                <span
                  className="library-item-category"
                  style={{ color: STATUS_COLORS[s.status] }}
                >
                  {s.status}
                </span>
              </button>
              <button
                className="library-item-delete"
                onClick={(e) => { e.stopPropagation(); lib.deleteStory(s.id); }}
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
