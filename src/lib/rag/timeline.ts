import type {
  Chapter,
  Era,
  Event,
  ReligionVersion,
  OrganizationVersion,
  Scene,
  TimeAnchor,
  Timeline,
  ValidTimeWindow,
  Revision,
} from "@/lib/types";
import type { RAGStore } from "@/lib/rag/store";

const UNKNOWN_RELATIVE_DAY = Number.POSITIVE_INFINITY;

function relativeDayOf(anchor: TimeAnchor | null | undefined): number {
  const day = anchor?.relativeDay;
  return typeof day === "number" && Number.isFinite(day) ? day : UNKNOWN_RELATIVE_DAY;
}

function byRelativeDay<T extends { relativeDay: number }>(a: T, b: T): number {
  return a.relativeDay - b.relativeDay;
}

async function loadTimeAnchors(
  store: RAGStore,
  ids: Iterable<string | undefined>
): Promise<Map<string, TimeAnchor>> {
  const uniqueIds = [...new Set([...ids].filter((id): id is string => Boolean(id && id.trim())))];
  const rows = await Promise.all(uniqueIds.map(async (id) => [id, await store.getTimeAnchor(id)] as const));
  const out = new Map<string, TimeAnchor>();
  for (const [id, row] of rows) {
    if (row) out.set(id, row);
  }
  return out;
}

export interface TimelineEventRow {
  event: Event;
  era?: Era;
  timeAnchor?: TimeAnchor;
  relativeDay: number;
}

export interface MasterTimelineView {
  timeline: Timeline;
  eras: Era[];
  events: TimelineEventRow[];
}

export async function buildMasterTimelineView(
  store: RAGStore,
  universeId: string,
  timelineId?: string
): Promise<MasterTimelineView | null> {
  const timelines = await store.listTimelinesByUniverse(universeId);
  const timeline =
    (timelineId ? timelines.find((row) => row.id === timelineId) : undefined) ??
    timelines.find((row) => row.timelineType === "master");
  if (!timeline) return null;

  const eras = await store.listErasByTimeline(timeline.id);
  const eraById = new Map(eras.map((row) => [row.id, row] as const));
  const eraIds = new Set(eras.map((row) => row.id));

  const universeEvents = await store.listEventsByUniverse(universeId);
  const events =
    eraIds.size > 0
      ? universeEvents.filter((row) => (row.eraId ? eraIds.has(row.eraId) : true))
      : universeEvents;

  const anchors = await loadTimeAnchors(store, events.map((row) => row.timeAnchorId));
  const rows: TimelineEventRow[] = events
    .map((event) => {
      const timeAnchor = anchors.get(event.timeAnchorId);
      return {
        event,
        era: event.eraId ? eraById.get(event.eraId) : undefined,
        timeAnchor,
        relativeDay: relativeDayOf(timeAnchor),
      };
    })
    .sort((a, b) => {
      const dayCmp = byRelativeDay(a, b);
      if (dayCmp !== 0) return dayCmp;
      return a.event.name.localeCompare(b.event.name);
    });

  return { timeline, eras, events: rows };
}

export interface BookTimelineSceneRow {
  chapter: Chapter;
  scene: Scene;
  timeAnchor: TimeAnchor | undefined;
  alignedEvent: Event | undefined;
  relativeDay: number;
}

export interface BookTimelineView {
  timelines: Timeline[];
  scenes: BookTimelineSceneRow[];
}

export async function buildBookTimelineView(
  store: RAGStore,
  bookId: string
): Promise<BookTimelineView> {
  const [timelines, chapters] = await Promise.all([
    store.listTimelinesByBook(bookId),
    store.listChaptersByBook(bookId),
  ]);
  if (chapters.length === 0) return { timelines, scenes: [] };

  const chapterById = new Map(chapters.map((row) => [row.id, row] as const));
  const scenesNested = await Promise.all(chapters.map((chapter) => store.listScenesByChapter(chapter.id)));
  const scenes = scenesNested.flat();

  const anchors = await loadTimeAnchors(store, scenes.map((row) => row.timeAnchorId));

  const universeId = timelines[0]?.universeId;
  const eventById = new Map<string, Event>();
  if (universeId) {
    const events = await store.listEventsByUniverse(universeId);
    for (const event of events) eventById.set(event.id, event);
  }

  const rows = scenes
    .map((scene) => {
      const chapter = chapterById.get(scene.chapterId);
      if (!chapter) return null;
      const timeAnchor = scene.timeAnchorId ? anchors.get(scene.timeAnchorId) : undefined;
      return {
        chapter,
        scene,
        timeAnchor,
        alignedEvent: scene.alignedEventId ? eventById.get(scene.alignedEventId) : undefined,
        relativeDay: relativeDayOf(timeAnchor),
      } satisfies BookTimelineSceneRow;
    })
    .filter((row): row is BookTimelineSceneRow => row !== null)
    .sort((a, b) => {
      const dayCmp = byRelativeDay(a, b);
      if (dayCmp !== 0) return dayCmp;
      if (a.chapter.number !== b.chapter.number) return a.chapter.number - b.chapter.number;
      return a.scene.number - b.scene.number;
    });

  return { timelines, scenes: rows };
}

export function buildEventDayIndex(events: Event[], anchors: Map<string, TimeAnchor>): Map<string, number> {
  const out = new Map<string, number>();
  for (const event of events) {
    const day = relativeDayOf(anchors.get(event.timeAnchorId));
    if (Number.isFinite(day)) out.set(event.id, day);
  }
  return out;
}

export function isValidAtEvent(
  window: ValidTimeWindow,
  eventId: string,
  eventDayById: Map<string, number>
): boolean {
  const targetDay = eventDayById.get(eventId);
  const startDay = eventDayById.get(window.validFromEventId);
  if (targetDay === undefined || startDay === undefined) return false;
  const endDay = window.validToEventId ? eventDayById.get(window.validToEventId) : undefined;
  if (endDay !== undefined) return targetDay >= startDay && targetDay <= endDay;
  return targetDay >= startDay;
}

export function selectVersionAtEvent<T extends ValidTimeWindow>(
  versions: T[],
  eventId: string,
  eventDayById: Map<string, number>
): T | null {
  const active = versions.filter((row) => isValidAtEvent(row, eventId, eventDayById));
  if (active.length === 0) return null;
  return active.sort((a, b) => {
    const aStart = eventDayById.get(a.validFromEventId) ?? UNKNOWN_RELATIVE_DAY;
    const bStart = eventDayById.get(b.validFromEventId) ?? UNKNOWN_RELATIVE_DAY;
    return bStart - aStart;
  })[0];
}

export function selectOrganizationVersionAtEvent(
  versions: OrganizationVersion[],
  eventId: string,
  eventDayById: Map<string, number>
): OrganizationVersion | null {
  return selectVersionAtEvent(versions, eventId, eventDayById);
}

export function selectReligionVersionAtEvent(
  versions: ReligionVersion[],
  eventId: string,
  eventDayById: Map<string, number>
): ReligionVersion | null {
  return selectVersionAtEvent(versions, eventId, eventDayById);
}

/**
 * System-time snapshot of immutable revisions.
 * Useful for reconstructing "what we believed at time T".
 */
export function revisionsAsOfSystemTime(revisions: Revision[], asOfMs: number): Revision[] {
  return revisions
    .filter((revision) => (revision.recordedAt ?? revision.createdAt) <= asOfMs)
    .sort((a, b) => (a.recordedAt ?? a.createdAt) - (b.recordedAt ?? b.createdAt));
}
