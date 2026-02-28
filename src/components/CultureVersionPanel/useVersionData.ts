"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { CultureVersion, Event as TimelineEvent } from "@/lib/types";

export interface VersionDraft {
  validFromEventId: string;
  validToEventId: string;
  changeTrigger: string;
  traitsRaw: string; // JSON string
}

export function useVersionData(cultureEntryId: string | undefined) {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const [versions, setVersions] = useState<CultureVersion[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!cultureEntryId) return;
    const [vers, evts] = await Promise.all([
      store.listCultureVersionsByCulture(cultureEntryId),
      store.listEventsByUniverse(libraryId),
    ]);
    const sorted = vers.sort((a, b) => a.createdAt - b.createdAt);
    setTimeout(() => {
      setVersions(sorted);
      setEvents(evts);
      setLoading(false);
    }, 0);
  }, [store, cultureEntryId, libraryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addVersion = useCallback(
    async (draft: VersionDraft): Promise<boolean> => {
      if (!cultureEntryId || !draft.validFromEventId) return false;
      let traits: Record<string, unknown> = {};
      try {
        const parsed = draft.traitsRaw.trim() ? JSON.parse(draft.traitsRaw) : {};
        if (typeof parsed === "object" && parsed !== null) {
          traits = parsed;
        }
      } catch {
        return false; // invalid JSON
      }
      const now = Date.now();
      await store.addCultureVersion({
        id: crypto.randomUUID(),
        cultureEntryId,
        validFromEventId: draft.validFromEventId,
        validToEventId: draft.validToEventId || undefined,
        changeTrigger: draft.changeTrigger || undefined,
        traits,
        createdAt: now,
        updatedAt: now,
      });
      await reload();
      return true;
    },
    [store, cultureEntryId, reload],
  );

  const eventName = useCallback(
    (eventId: string | undefined): string => {
      if (!eventId) return "—";
      return events.find((e) => e.id === eventId)?.name ?? eventId.slice(0, 8) + "…";
    },
    [events],
  );

  return { versions, events, loading, addVersion, eventName };
}
