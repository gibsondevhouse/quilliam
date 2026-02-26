"use client";

import { useCallback, useState, useEffect } from "react";
import type { WorldEntry } from "./Sidebar";

interface WorldEditorProps {
  entry: WorldEntry;
  onChange: (updated: WorldEntry) => void;
}

const CATEGORY_OPTIONS = [
  "Lore",
  "Rules",
  "History",
  "Culture",
  "Magic System",
  "Technology",
  "Politics",
  "Religion",
  "Economy",
  "Other",
];

export function WorldEditor({ entry, onChange }: WorldEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category);
  const [notes, setNotes] = useState(entry.notes);

  useEffect(() => {
    setTitle(entry.title);
    setCategory(entry.category);
    setNotes(entry.notes);
  }, [entry]);

  const update = useCallback(
    (patch: Partial<WorldEntry>) => {
      onChange({ ...entry, ...patch });
    },
    [entry, onChange]
  );

  return (
    <div className="detail-editor">
      <div className="detail-editor-header">
        <span className="detail-editor-badge world">World</span>
      </div>

      <div className="detail-field">
        <label className="detail-label">Title</label>
        <input
          className="detail-input"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            update({ title: e.target.value });
          }}
          placeholder="Entry title"
        />
      </div>

      <div className="detail-field">
        <label className="detail-label">Category</label>
        <div className="detail-chips">
          {CATEGORY_OPTIONS.map((c) => (
            <button
              key={c}
              className={`detail-chip ${category === c ? "active" : ""}`}
              onClick={() => {
                setCategory(c);
                update({ category: c });
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="detail-field detail-field-grow">
        <label className="detail-label">Notes</label>
        <textarea
          className="detail-textarea"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            update({ notes: e.target.value });
          }}
          placeholder="Details, connections, implications for the narrative..."
        />
      </div>
    </div>
  );
}
