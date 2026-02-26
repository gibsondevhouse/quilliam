"use client";

import { useCallback, useState, useEffect } from "react";
import type { LocationEntry } from "./Sidebar";

interface LocationEditorProps {
  location: LocationEntry;
  onChange: (updated: LocationEntry) => void;
}

export function LocationEditor({ location, onChange }: LocationEditorProps) {
  const [name, setName] = useState(location.name);
  const [description, setDescription] = useState(location.description);

  useEffect(() => {
    setName(location.name);
    setDescription(location.description);
  }, [location]);

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

      <div className="detail-field">
        <label className="detail-label">Name</label>
        <input
          className="detail-input"
          value={name}
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
          value={description}
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
