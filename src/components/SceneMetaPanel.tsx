"use client";

/**
 * SceneMetaPanel — Links a scene to a location entry and timeline event.
 * Rendered alongside the scene editor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import type { Entry, Scene as SceneRecord } from "@/lib/types";

interface SceneMetaPanelProps {
  /** RAG node ID (used as Scene store ID) */
  sceneNodeId: string;
  /** Chapter node ID (parent of the scene) */
  chapterId: string;
}

export function SceneMetaPanel({ sceneNodeId, chapterId }: SceneMetaPanelProps) {
  const store = useStore();

  const [scene, setScene] = useState<SceneRecord | null>(null);
  const [locationEntries, setLocationEntries] = useState<Entry[]>([]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const [localLocationId, setLocalLocationId] = useState("");
  const [localAlignedEventId, setLocalAlignedEventId] = useState("");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const existing = await store.getSceneById(sceneNodeId);
      if (existing) {
        setScene(existing);
        setLocalLocationId(existing.locationEntryId ?? "");
        setLocalAlignedEventId(existing.alignedEventId ?? "");
      }
      const locs = await store.queryEntriesByType("location");
      setLocationEntries(locs);
    })();
  }, [store, sceneNodeId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const now = Date.now();
    const next: SceneRecord = scene ?? {
      id: sceneNodeId,
      chapterId,
      number: 1,
      sceneMd: "",
      createdAt: now,
      updatedAt: now,
    };
    const saved: SceneRecord = {
      ...next,
      locationEntryId: localLocationId || undefined,
      alignedEventId: localAlignedEventId || undefined,
      updatedAt: now,
    };
    await store.putScene(saved);
    setScene(saved);
    setSaving(false);
  }, [store, scene, sceneNodeId, chapterId, localLocationId, localAlignedEventId]);

  const isDirty =
    localLocationId !== (scene?.locationEntryId ?? "") ||
    localAlignedEventId !== (scene?.alignedEventId ?? "");

  return (
    <div className="scene-meta-panel">
      <h4 className="scene-meta-heading">Scene Links</h4>
      <div className="scene-meta-field">
        <label htmlFor="scene-location">Location</label>
        <select
          id="scene-location"
          className="canonical-doc-input"
          value={localLocationId}
          onChange={(e) => setLocalLocationId(e.target.value)}
        >
          <option value="">— None —</option>
          {locationEntries.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div className="scene-meta-field">
        <label htmlFor="scene-event">Aligned Event ID</label>
        <input
          id="scene-event"
          className="canonical-doc-input"
          placeholder="evt_…"
          value={localAlignedEventId}
          onChange={(e) => setLocalAlignedEventId(e.target.value)}
        />
        <small className="scene-meta-hint">
          Copy the event ID from the Master Timeline page.
        </small>
      </div>
      {isDirty && (
        <button
          className="library-page-action primary"
          disabled={saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save Scene Links"}
        </button>
      )}
      {!isDirty && scene && (
        <p className="scene-meta-saved">
          {[
            scene.locationEntryId && `Location: ${locationEntries.find((e) => e.id === scene.locationEntryId)?.name ?? scene.locationEntryId}`,
            scene.alignedEventId && `Event: ${scene.alignedEventId}`,
          ].filter(Boolean).join(" · ") || "No links set."}
        </p>
      )}
    </div>
  );
}
