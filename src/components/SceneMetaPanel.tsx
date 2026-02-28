"use client";

/**
 * SceneMetaPanel — Links a scene to a location, POV character, and timeline event.
 * Rendered alongside the scene editor.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { Entry, Event as TimelineEvent, Scene as SceneRecord } from "@/lib/types";

interface SceneMetaPanelProps {
  /** RAG node ID (used as Scene store ID) */
  sceneNodeId: string;
  /** Chapter node ID (parent of the scene) */
  chapterId: string;
}

export function SceneMetaPanel({ sceneNodeId, chapterId }: SceneMetaPanelProps) {
  const store = useStore();
  const { libraryId } = useLibraryContext();

  const [scene, setScene] = useState<SceneRecord | null>(null);
  const [locationEntries, setLocationEntries] = useState<Entry[]>([]);
  const [characterEntries, setCharacterEntries] = useState<Entry[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const [localLocationId, setLocalLocationId] = useState("");
  const [localPovCharacterId, setLocalPovCharacterId] = useState("");
  const [localAlignedEventId, setLocalAlignedEventId] = useState("");

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void (async () => {
      const [existing, locs, chars, evts] = await Promise.all([
        store.getSceneById(sceneNodeId),
        store.queryEntriesByType("location"),
        store.queryEntriesByType("character"),
        store.listEventsByUniverse(libraryId),
      ]);
      if (existing) {
        setScene(existing);
        setLocalLocationId(existing.locationEntryId ?? "");
        setLocalPovCharacterId(existing.povCharacterEntryId ?? "");
        setLocalAlignedEventId(existing.alignedEventId ?? "");
      }
      setLocationEntries(locs);
      setCharacterEntries(chars);
      setEvents(evts);
    })();
  }, [store, sceneNodeId, libraryId]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const now = Date.now();
    const base: SceneRecord = scene ?? {
      id: sceneNodeId,
      chapterId,
      number: 1,
      sceneMd: "",
      createdAt: now,
      updatedAt: now,
    };
    const saved: SceneRecord = {
      ...base,
      locationEntryId: localLocationId || undefined,
      povCharacterEntryId: localPovCharacterId || undefined,
      alignedEventId: localAlignedEventId || undefined,
      updatedAt: now,
    };
    await store.putScene(saved);
    setScene(saved);
    setSaving(false);
  }, [store, scene, sceneNodeId, chapterId, localLocationId, localPovCharacterId, localAlignedEventId]);

  const isDirty =
    localLocationId !== (scene?.locationEntryId ?? "") ||
    localPovCharacterId !== (scene?.povCharacterEntryId ?? "") ||
    localAlignedEventId !== (scene?.alignedEventId ?? "");

  const savedSummaryParts = [
    scene?.locationEntryId && `📍 ${locationEntries.find((e) => e.id === scene.locationEntryId)?.name ?? "?"}`,
    scene?.povCharacterEntryId && `👤 ${characterEntries.find((e) => e.id === scene.povCharacterEntryId)?.name ?? "?"}`,
    scene?.alignedEventId && `⚡ ${events.find((e) => e.id === scene.alignedEventId)?.name ?? scene.alignedEventId}`,
  ].filter(Boolean);

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
        <label htmlFor="scene-pov">POV Character</label>
        <select
          id="scene-pov"
          className="canonical-doc-input"
          value={localPovCharacterId}
          onChange={(e) => setLocalPovCharacterId(e.target.value)}
        >
          <option value="">— None —</option>
          {characterEntries.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>

      <div className="scene-meta-field">
        <label htmlFor="scene-event">Timeline Event</label>
        <select
          id="scene-event"
          className="canonical-doc-input"
          value={localAlignedEventId}
          onChange={(e) => setLocalAlignedEventId(e.target.value)}
        >
          <option value="">— None —</option>
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>{ev.name}</option>
          ))}
        </select>
        {events.length === 0 && (
          <small className="scene-meta-hint">
            Add events on the Master Timeline page first.
          </small>
        )}
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
      {!isDirty && savedSummaryParts.length > 0 && (
        <p className="scene-meta-saved">{savedSummaryParts.join(" · ")}</p>
      )}
      {!isDirty && savedSummaryParts.length === 0 && (
        <p className="scene-meta-saved">No links set.</p>
      )}
    </div>
  );
}
