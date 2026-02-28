"use client";

import { useEffect, useState, useCallback } from "react";
import { useStore } from "@/lib/context/useStore";
import { useLibraryContext } from "@/lib/context/LibraryContext";
import type { OrganizationVersion, ReligionVersion, Event as TimelineEvent } from "@/lib/types";

export type EntityVersionKind = "organization" | "religion";
export type AnyEntityVersion = OrganizationVersion | ReligionVersion;

export interface VersionDraft {
  validFromEventId: string;
  validToEventId: string;
  changeTrigger: string;
  traitsRaw: string; // JSON string
}

const BLANK_DRAFT: VersionDraft = {
  validFromEventId: "",
  validToEventId: "",
  changeTrigger: "",
  traitsRaw: "",
};

export { BLANK_DRAFT };

export function useEntityVersionData(
  entityKind: EntityVersionKind,
  entryId: string | undefined,
) {
  const store = useStore();
  const { libraryId } = useLibraryContext();
  const [versions, setVersions] = useState<AnyEntityVersion[]>([]);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!entryId) return;
    const [vers, evts] = await Promise.all([
      entityKind === "organization"
        ? store.listOrganizationVersionsByOrganization(entryId)
        : store.listReligionVersionsByReligion(entryId),
      store.listEventsByUniverse(libraryId),
    ]);
    const sorted = [...vers].sort((a, b) => a.createdAt - b.createdAt);
    setTimeout(() => {
      setVersions(sorted);
      setEvents(evts);
      setLoading(false);
    }, 0);
  }, [store, entityKind, entryId, libraryId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const addVersion = useCallback(
    async (draft: VersionDraft): Promise<boolean> => {
      if (!entryId || !draft.validFromEventId) return false;
      let traits: Record<string, unknown> = {};
      try {
        const parsed = draft.traitsRaw.trim() ? JSON.parse(draft.traitsRaw) : {};
        if (typeof parsed === "object" && parsed !== null) traits = parsed as Record<string, unknown>;
      } catch {
        return false;
      }
      const now = Date.now();
      if (entityKind === "organization") {
        await store.addOrganizationVersion({
          id: crypto.randomUUID(),
          organizationEntryId: entryId,
          validFromEventId: draft.validFromEventId,
          validToEventId: draft.validToEventId || undefined,
          changeTrigger: draft.changeTrigger || undefined,
          traits,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        await store.addReligionVersion({
          id: crypto.randomUUID(),
          religionEntryId: entryId,
          validFromEventId: draft.validFromEventId,
          validToEventId: draft.validToEventId || undefined,
          changeTrigger: draft.changeTrigger || undefined,
          traits,
          createdAt: now,
          updatedAt: now,
        });
      }
      await reload();
      return true;
    },
    [store, entityKind, entryId, reload],
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
