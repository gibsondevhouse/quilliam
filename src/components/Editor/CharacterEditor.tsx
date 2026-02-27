"use client";

import { useCallback, useState } from "react";
import type { CharacterEntry } from "@/lib/types";
import type { ChangeSet } from "@/lib/changeSets";
import { EntityChangePanel } from "@/components/Editor/EntityChangePanel";

interface CharacterEditorProps {
  character: CharacterEntry;
  onChange: (updated: CharacterEntry) => void;
  draftText?: string;
  pendingChangeSets?: ChangeSet[];
  onAcceptHunk?: (id: string) => void;
  onRejectHunk?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

const ROLE_OPTIONS = [
  "Protagonist",
  "Antagonist",
  "Supporting",
  "Mentor",
  "Love Interest",
  "Sidekick",
  "Narrator",
  "Other",
];

export function CharacterEditor({
  character,
  onChange,
  draftText,
  pendingChangeSets = [],
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: CharacterEditorProps) {
  const [name, setName] = useState(character.name);
  const [role, setRole] = useState(character.role);
  const [notes, setNotes] = useState(character.notes);
  const pending = pendingChangeSets.filter((cs) => cs.status === "pending");
  const hasPending = pending.length > 0;
  const visibleNotes = hasPending ? draftText ?? notes : notes;

  const update = useCallback(
    (patch: Partial<CharacterEntry>) => {
      onChange({ ...character, ...patch });
    },
    [character, onChange]
  );

  return (
    <div className="detail-editor">
      <div className="detail-editor-header">
        <span className="detail-editor-badge">Character</span>
      </div>

      <EntityChangePanel
        entityLabel={name || "Unnamed Character"}
        pendingChangeSets={pending}
        draftText={draftText ?? notes}
        onAcceptHunk={onAcceptHunk}
        onRejectHunk={onRejectHunk}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />

      <div className="detail-field">
        <label className="detail-label">Name</label>
        <input
          className="detail-input"
          value={name}
          disabled={hasPending}
          onChange={(e) => {
            setName(e.target.value);
            update({ name: e.target.value });
          }}
          placeholder="Character name"
        />
      </div>

      <div className="detail-field">
        <label className="detail-label">Role</label>
        <div className="detail-chips">
          {ROLE_OPTIONS.map((r) => (
            <button
              key={r}
              className={`detail-chip ${role === r ? "active" : ""}`}
              disabled={hasPending}
              onClick={() => {
                setRole(r);
                update({ role: r });
              }}
            >
              {r}
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
          placeholder="Backstory, personality traits, physical description, arc notes..."
        />
      </div>
    </div>
  );
}
