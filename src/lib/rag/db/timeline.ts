import type {
  PersistedCalendar,
  PersistedEra,
  PersistedEvent,
  PersistedTimeAnchor,
  PersistedTimeline,
} from "@/lib/rag/store";
import type { TimelineStore } from "@/lib/rag/store/TimelineStore";
import type { QuillDB } from "./schema";

export function createTimelineStore(db: QuillDB): TimelineStore {
  return {
    async putTimeline(entry: PersistedTimeline): Promise<void> {
      await db.put("timelines", entry);
    },
    async listTimelinesByUniverse(universeId: string): Promise<PersistedTimeline[]> {
      return db.getAllFromIndex("timelines", "by_universe", universeId);
    },
    async listTimelinesByBook(bookId: string): Promise<PersistedTimeline[]> {
      return db.getAllFromIndex("timelines", "by_book", bookId);
    },

    async putEra(entry: PersistedEra): Promise<void> {
      await db.put("eras", entry);
    },
    async listErasByTimeline(timelineId: string): Promise<PersistedEra[]> {
      return db.getAllFromIndex("eras", "by_timeline", timelineId);
    },

    async putEvent(entry: PersistedEvent): Promise<void> {
      await db.put("events", entry);
    },
    async listEventsByUniverse(universeId: string): Promise<PersistedEvent[]> {
      return db.getAllFromIndex("events", "by_universe", universeId);
    },
    async listEventsByEra(eraId: string): Promise<PersistedEvent[]> {
      return db.getAllFromIndex("events", "by_era", eraId);
    },

    async putCalendar(entry: PersistedCalendar): Promise<void> {
      await db.put("calendars", entry);
    },
    async listCalendarsByUniverse(universeId: string): Promise<PersistedCalendar[]> {
      return db.getAllFromIndex("calendars", "by_universe", universeId);
    },

    async putTimeAnchor(entry: PersistedTimeAnchor): Promise<void> {
      await db.put("timeAnchors", entry);
    },
    async getTimeAnchor(id: string): Promise<PersistedTimeAnchor | null> {
      const record = await db.get("timeAnchors", id);
      return record ?? null;
    },
    async listTimeAnchorsByCalendar(calendarId: string): Promise<PersistedTimeAnchor[]> {
      return db.getAllFromIndex("timeAnchors", "by_calendar", calendarId);
    },
  };
}
