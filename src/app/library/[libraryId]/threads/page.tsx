"use client";

import { useLibraryContext } from "@/lib/context/LibraryContext";

export default function ThreadsPage() {
  const lib = useLibraryContext();

  return (
    <div className="library-page threads-page">
      <div className="library-page-header">
        <h2>Threads</h2>
        <button className="library-page-action" onClick={() => lib.addChat()}>+ New Thread</button>
      </div>
      {lib.chats.length === 0 ? (
        <div className="library-page-empty">
          <p>No threads yet.</p>
          <button className="library-page-action primary" onClick={() => lib.addChat()}>
            Start your first thread
          </button>
        </div>
      ) : (
        <ul className="library-item-list">
          {lib.chats.map((c) => (
            <li key={c.id} className="library-item-row">
              <button
                className={`library-item-btn ${lib.activeChatId === c.id ? "active" : ""}`}
                onClick={() => lib.selectChat(c.id)}
              >
                <span className="library-item-icon">💬</span>
                <div className="library-item-info">
                  <span className="library-item-title">{c.title}</span>
                  {c.preview && <span className="library-item-preview">{c.preview}</span>}
                </div>
              </button>
              <button
                className="library-item-delete"
                onClick={(e) => { e.stopPropagation(); lib.deleteChat(c.id); }}
                title="Delete thread"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="library-page-hint">
        Open the AI panel (top-right chat button) to continue a thread.
      </p>
    </div>
  );
}
