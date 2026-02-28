import type {
  PersistedCalendar,
  PersistedEra,
  PersistedEvent,
  PersistedTimeAnchor,
  PersistedTimeline,
} from "@/lib/rag/store";

export interface TimelineStore {
  putTimeline(entry: PersistedTimeline): Promise<void>;
  listTimelinesByUniverse(universeId: string): Promise<PersistedTimeline[]>;
  listTimelinesByBook(bookId: string): Promise<PersistedTimeline[]>;
  putEra(entry: PersistedEra): Promise<void>;
  listErasByTimeline(timelineId: string): Promise<PersistedEra[]>;
  putEvent(entry: PersistedEvent): Promise<void>;
  listEventsByUniverse(universeId: string): Promise<PersistedEvent[]>;
  listEventsByEra(eraId: string): Promise<PersistedEvent[]>;
  putCalendar(entry: PersistedCalendar): Promise<void>;
  listCalendarsByUniverse(universeId: string): Promise<PersistedCalendar[]>;
  putTimeAnchor(entry: PersistedTimeAnchor): Promise<void>;
  getTimeAnchor(id: string): Promise<PersistedTimeAnchor | null>;
  listTimeAnchorsByCalendar(calendarId: string): Promise<PersistedTimeAnchor[]>;
}
