"use client";

import { useCallback, useState } from "react";
import type { LocationEntry } from "@/lib/types";
import type { ChangeSet } from "@/lib/changeSets";
import { EntityChangePanel } from "@/components/Editor/EntityChangePanel";

interface LocationEditorProps {
  location: LocationEntry;
  onChange: (updated: LocationEntry) => void;
  draftText?: string;
  pendingChangeSets?: ChangeSet[];
  onAcceptHunk?: (id: string) => void;
  onRejectHunk?: (id: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function LocationEditor({
  location,
  onChange,
  draftText,
  pendingChangeSets = [],
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: LocationEditorProps) {
  const [name, setName] = useState(location.name);
  const [description, setDescription] = useState(location.description);
  const pending = pendingChangeSets.filter((cs) => cs.status === "pending");
  const hasPending = pending.length > 0;
  const visibleDescription = hasPending ? draftText ?? description : description;

  const update = useCallback(
    (patch: Partial<LocationEntry>) => {
      onChange({ ...location, ...patch });
    },
    [location, onChange]
  );

  return (
    <div className="detail-editor">
      <div className="detail-editor-header">
        <span className="detail-editor-badge location">Location</span>
      </div>

      <EntityChangePanel
        entityLabel={name || "Unnamed Location"}
        pendingChangeSets={pending}
        draftText={draftText ?? description}
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
          placeholder="Location name"
        />
      </div>

      <div className="detail-field detail-field-grow">
        <label className="detail-label">Description</label>
        <textarea
          className="detail-textarea"
          value={visibleDescription}
          disabled={hasPending}
          onChange={(e) => {
            setDescription(e.target.value);
            update({ description: e.target.value });
          }}
          placeholder="Geography, atmosphere, significance to the story, inhabitants..."
        />
      </div>
    </div>
  );
}
