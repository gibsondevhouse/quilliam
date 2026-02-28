"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import { useWorkspaceContext } from "@/lib/context/WorkspaceContext";
import type { Event as TimelineEvent, Scene, Entry } from "@/lib/types";

export interface SceneSummary {
  nodeId: string;
  nodeTitle: string;
  chapterTitle: string;
  scene: Scene | null;
  povCharacterName?: string;
  locationName?: string;
}

export interface EventWithScenes {
  event: TimelineEvent;
  scenes: SceneSummary[];
}

export interface UnlinkedSceneSummary extends SceneSummary {
  chapterTitle: string;
}

export function useBookTimelineData(storyId: string) {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const { ragNodes } = useWorkspaceContext();

  const [eventGroups, setEventGroups] = useState<EventWithScenes[]>([]);
  const [unlinked, setUnlinked] = useState<UnlinkedSceneSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // 1. Collect chapter nodes for this story
    const chapterNodes = Object.values(ragNodes).filter(
      (n) => n.parentId === storyId && n.type === "chapter",
    );

    // 2. Collect scene nodes for each chapter
    const scenePairs: Array<{ sceneNode: (typeof chapterNodes)[0]; chapterTitle: string }> = [];
    for (const ch of chapterNodes) {
      const sceneNodes = Object.values(ragNodes).filter(
        (n) => n.parentId === ch.id && n.type === "scene",
      );
      for (const sn of sceneNodes) {
        scenePairs.push({ sceneNode: sn, chapterTitle: ch.title || "Untitled Chapter" });
      }
    }

    // 3. Load Scene records + events in parallel
    const [storeScenes, events] = await Promise.all([
      Promise.all(scenePairs.map(({ sceneNode }) => store.getSceneById(sceneNode.id))),
      store.listEventsByUniverse(libraryId),
    ]);

    // 4. Collect entry IDs we need names for
    const entryIds = new Set<string>();
    for (const s of storeScenes) {
      if (s?.povCharacterEntryId) entryIds.add(s.povCharacterEntryId);
      if (s?.locationEntryId) entryIds.add(s.locationEntryId);
    }

    // 5. Fetch entry names
    const entryMap = new Map<string, string>();
    await Promise.all(
      Array.from(entryIds).map(async (id) => {
        const entry: Entry | undefined = await store.getEntryById(id);
        if (entry) entryMap.set(id, entry.name);
      }),
    );

    // 6. Build scene summaries
    const summaries: SceneSummary[] = scenePairs.map(({ sceneNode, chapterTitle }, i) => {
      const scene = storeScenes[i] ?? null;
      return {
        nodeId: sceneNode.id,
        nodeTitle: sceneNode.title || `Scene`,
        chapterTitle,
        scene,
        povCharacterName: scene?.povCharacterEntryId ? entryMap.get(scene.povCharacterEntryId) : undefined,
        locationName: scene?.locationEntryId ? entryMap.get(scene.locationEntryId) : undefined,
      };
    });

    // 7. Group by alignedEventId
    const eventMap = new Map<string, TimelineEvent>(events.map((e) => [e.id, e]));
    const grouped = new Map<string, SceneSummary[]>();
    const unlinkedList: UnlinkedSceneSummary[] = [];

    for (const s of summaries) {
      const eventId = s.scene?.alignedEventId;
      if (eventId && eventMap.has(eventId)) {
        if (!grouped.has(eventId)) grouped.set(eventId, []);
        grouped.get(eventId)!.push(s);
      } else {
        unlinkedList.push(s);
      }
    }

    // 8. Build ordered list of EventWithScenes (only events that have scenes)
    const groups: EventWithScenes[] = events
      .filter((e) => grouped.has(e.id))
      .map((event) => ({ event, scenes: grouped.get(event.id)! }));

    setTimeout(() => {
      setEventGroups(groups);
      setUnlinked(unlinkedList);
      setLoading(false);
    }, 0);
  }, [store, libraryId, storyId, ragNodes]);

  useEffect(() => {
    load();
  }, [load]);

  return { eventGroups, unlinked, loading };
}
