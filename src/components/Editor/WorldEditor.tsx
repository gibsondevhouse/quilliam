"use client";

import { useCallback, useState } from "react";
import type { WorldEntry } from "@/lib/types";
import type { ChangeSet } from "@/lib/changeSets";
import { EntityChangePanel } from "@/components/Editor/EntityChangePanel";

interface WorldEditorProps {
  entry: WorldEntry;
  onChange: (updated: WorldEntry) => void;
  draftText?: string;
  pendingChangeSets?: ChangeSet[];
  onAcceptHunk?: (id: string) => void;
  onRejectHunk?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
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

export function WorldEditor({
  entry,
  onChange,
  draftText,
  pendingChangeSets = [],
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: WorldEditorProps) {
  const [title, setTitle] = useState(entry.title);
  const [category, setCategory] = useState(entry.category);
  const [notes, setNotes] = useState(entry.notes);
  const pending = pendingChangeSets.filter((cs) => cs.status === "pending");
  const hasPending = pending.length > 0;
  const visibleNotes = hasPending ? draftText ?? notes : notes;

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

      <EntityChangePanel
        entityLabel={title || "Untitled Entry"}
        pendingChangeSets={pending}
        draftText={draftText ?? notes}
        onAcceptHunk={onAcceptHunk}
        onRejectHunk={onRejectHunk}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />

      <div className="detail-field">
        <label className="detail-label">Title</label>
        <input
          className="detail-input"
          value={title}
          disabled={hasPending}
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
              disabled={hasPending}
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
          value={visibleNotes}
          disabled={hasPending}
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
