import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useRAGContext } from "@/lib/context/RAGContext";
import { makeId } from "@/lib/domain/idUtils";
import type { Era, Event, Timeline } from "@/lib/types";
import type { EraWithEvents } from "../timelineTypes";

export interface UseTimelineDataReturn {
  masterTimeline: Timeline | null;
  eraData: EraWithEvents[];
  loading: boolean;
  // Era creation
  newEraName: string;
  setNewEraName: (v: string) => void;
  handleCreateTimeline: () => Promise<void>;
  handleAddEra: () => Promise<void>;
  // Event creation
  addingToEra: string | null;
  setAddingToEra: (id: string | null) => void;
  newEventName: string;
  setNewEventName: (v: string) => void;
  newEventType: string;
  setNewEventType: (v: string) => void;
  newEventDesc: string;
  setNewEventDesc: (v: string) => void;
  handleAddEvent: (eraId: string) => Promise<void>;
}

export function useTimelineData(): UseTimelineDataReturn {
  const { storeRef, storeReady } = useRAGContext();
  const params = useParams<{ libraryId: string }>();
  const universeId = params.libraryId;

  const [masterTimeline, setMasterTimeline] = useState<Timeline | null>(null);
  const [eraData, setEraData] = useState<EraWithEvents[]>([]);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);

  const [newEraName, setNewEraName] = useState("");
  const [addingToEra, setAddingToEra] = useState<string | null>(null);
  const [newEventName, setNewEventName] = useState("");
  const [newEventType, setNewEventType] = useState("narrative");
  const [newEventDesc, setNewEventDesc] = useState("");

  const loadData = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const timelines = await store.listTimelinesByUniverse(universeId);
    const master = timelines.find((t) => t.timelineType === "master") ?? null;
    setMasterTimeline(master);

    if (!master) {
      setLoading(false);
      return;
    }

    const eras = await store.listErasByTimeline(master.id);
    const eraRows: EraWithEvents[] = await Promise.all(
      eras.map(async (era) => ({
        era,
        events: await store.listEventsByEra(era.id),
      })),
    );
    setEraData(eraRows);
    setLoading(false);
  }, [storeRef, universeId]);

  useEffect(() => {
    if (!storeReady || loadedRef.current) return;
    loadedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData();
  }, [storeReady, loadData]);

  const handleCreateTimeline = useCallback(async () => {
    const store = storeRef.current;
    if (!store) return;
    const now = Date.now();
    const tl: Timeline = {
      id: makeId("tl"),
      universeId,
      timelineType: "master",
      name: "Master Timeline",
      createdAt: now,
      updatedAt: now,
    };
    await store.putTimeline(tl);
    setMasterTimeline(tl);
    setEraData([]);
  }, [storeRef, universeId]);

  const handleAddEra = useCallback(async () => {
    if (!masterTimeline || !newEraName.trim()) return;
    const store = storeRef.current;
    if (!store) return;
    const now = Date.now();
    const era: Era = {
      id: makeId("era"),
      timelineId: masterTimeline.id,
      name: newEraName.trim(),
      createdAt: now,
      updatedAt: now,
    };
    await store.putEra(era);
    setEraData((prev) => [...prev, { era, events: [] }]);
    setNewEraName("");
  }, [masterTimeline, newEraName, storeRef]);

  const handleAddEvent = useCallback(async (eraId: string) => {
    if (!newEventName.trim() || !masterTimeline) return;
    const store = storeRef.current;
    if (!store) return;
    const now = Date.now();
    const anchorId = makeId("ta");
    const defaultCalendars = await store.listCalendarsByUniverse(universeId);
    const calendarId = defaultCalendars[0]?.id ?? "default";
    await store.putTimeAnchor({
      id: anchorId,
      calendarId,
      precision: "approximate",
      dateParts: {},
      relativeDay: 0,
      createdAt: now,
      updatedAt: now,
    });
    const event: Event = {
      id: makeId("evt"),
      universeId,
      timeAnchorId: anchorId,
      eraId,
      name: newEventName.trim(),
      eventType: newEventType,
      descriptionMd: newEventDesc.trim() || undefined,
      createdAt: now,
      updatedAt: now,
    };
    await store.putEvent(event);
    setEraData((prev) =>
      prev.map((row) =>
        row.era.id === eraId
          ? { ...row, events: [...row.events, event] }
          : row,
      ),
    );
    setNewEventName("");
    setNewEventDesc("");
    setAddingToEra(null);
  }, [masterTimeline, newEventName, newEventType, newEventDesc, storeRef, universeId]);

  return {
    masterTimeline,
    eraData,
    loading,
    newEraName,
    setNewEraName,
    handleCreateTimeline,
    handleAddEra,
    addingToEra,
    setAddingToEra,
    newEventName,
    setNewEventName,
    newEventType,
    setNewEventType,
    newEventDesc,
    setNewEventDesc,
    handleAddEvent,
  };
}
