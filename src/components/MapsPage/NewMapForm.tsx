"use client";

import type { RefObject } from "react";

interface NewMapFormProps {
  newMapName: string;
  setNewMapName: (v: string) => void;
  newMapImageUri: string;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function NewMapForm({
  newMapName,
  setNewMapName,
  newMapImageUri,
  fileInputRef,
  onFileChange,
  onSubmit,
  onCancel,
}: NewMapFormProps) {
  return (
    <div className="maps-new-form">
      <input
        className="canonical-doc-input"
        placeholder="Map name…"
        value={newMapName}
        onChange={(e) => setNewMapName(e.target.value)}
      />
      <div className="maps-file-row">
        <button
          className="library-page-action"
          type="button"
          onClick={() => fileInputRef.current?.click()}
        >
          {newMapImageUri ? "Change image" : "Upload image (optional)"}
        </button>
        {newMapImageUri && <span className="maps-image-ready">Image loaded ✓</span>}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={onFileChange}
        />
      </div>
      <div className="maps-new-form-actions">
        <button
          className="library-page-action primary"
          disabled={!newMapName.trim()}
          onClick={onSubmit}
        >
          Create Map
        </button>
        <button className="library-page-action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
