"use client";

import { useLibraryContext } from "@/lib/context/LibraryContext";
import { WorldEditor } from "@/components/Editor/WorldEditor";

export default function WorldPage() {
  const lib = useLibraryContext();
  const active = lib.worldEntries.find((w) => w.id === lib.activeWorldEntryId);

  return (
    <div className="library-page world-page split-page">
      <div className="split-page-list">
        <div className="library-page-header">
          <h2>World</h2>
          <button className="library-page-action" onClick={() => lib.addWorldEntry()}>+ Add</button>
        </div>
        {lib.worldEntries.length === 0 ? (
          <div className="library-page-empty">
            <p>No world entries yet.</p>
            <button className="library-page-action primary" onClick={() => lib.addWorldEntry()}>
              Add lore, rules, or history
            </button>
          </div>
        ) : (
          <ul className="library-item-list">
            {lib.worldEntries.map((w) => (
              <li key={w.id} className="library-item-row">
                <button
                  className={`library-item-btn ${lib.activeWorldEntryId === w.id ? "active" : ""}`}
                  onClick={() => lib.selectWorldEntry(w.id)}
                >
                  <span className="library-item-icon">🌍</span>
                  <div className="library-item-info">
                    <span className="library-item-title">{w.title || "Untitled"}</span>
                    {w.category && <span className="library-item-preview">{w.category}</span>}
                  </div>
                </button>
                <button
                  className="library-item-delete"
                  onClick={(e) => { e.stopPropagation(); lib.deleteWorldEntry(w.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="split-page-editor">
        {active ? (
          <WorldEditor
            key={active.id}
            entry={active}
            onChange={lib.updateWorldEntry}
          />
        ) : (
          <div className="library-page-empty">
            <p>Select an entry to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
