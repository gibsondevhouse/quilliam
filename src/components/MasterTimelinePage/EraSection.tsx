import type { Event } from "@/lib/types";
import type { EraWithEvents } from "./timelineTypes";

interface EraSectionProps extends EraWithEvents {
  addingToEra: string | null;
  setAddingToEra: (id: string | null) => void;
  newEventName: string;
  setNewEventName: (v: string) => void;
  newEventType: string;
  setNewEventType: (v: string) => void;
  newEventDesc: string;
  setNewEventDesc: (v: string) => void;
  onAddEvent: (eraId: string) => void;
}

const EVENT_TYPES = ["narrative", "political", "battle", "natural", "cultural", "other"] as const;

function EventItem({ event }: { event: Event }) {
  return (
    <li className="master-timeline-event">
      <div className="master-timeline-event-header">
        <span className="master-timeline-event-type">{event.eventType}</span>
        <strong className="master-timeline-event-name">{event.name}</strong>
      </div>
      {event.descriptionMd && (
        <p className="master-timeline-event-desc">{event.descriptionMd}</p>
      )}
      <div className="master-timeline-event-id">
        <small className="entry-related-badge">ID: {event.id}</small>
        <small className="master-timeline-event-hint">
          Link a scene to this event by setting <code>alignedEventId</code> in the scene editor.
        </small>
      </div>
    </li>
  );
}

export function EraSection({
  era,
  events,
  addingToEra,
  setAddingToEra,
  newEventName,
  setNewEventName,
  newEventType,
  setNewEventType,
  newEventDesc,
  setNewEventDesc,
  onAddEvent,
}: EraSectionProps) {
  const isAdding = addingToEra === era.id;

  return (
    <section className="master-timeline-era">
      <div className="master-timeline-era-header">
        <h3 className="master-timeline-era-name">{era.name}</h3>
        <button
          className="library-page-action"
          onClick={() => setAddingToEra(isAdding ? null : era.id)}
        >
          + Add Event
        </button>
      </div>

      {isAdding && (
        <div className="master-timeline-add-event">
          <input
            className="canonical-doc-input"
            placeholder="Event name…"
            value={newEventName}
            onChange={(e) => setNewEventName(e.target.value)}
            autoFocus
          />
          <select
            className="canonical-doc-input"
            value={newEventType}
            onChange={(e) => setNewEventType(e.target.value)}
          >
            {EVENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            className="canonical-doc-input"
            placeholder="Description (optional)…"
            value={newEventDesc}
            onChange={(e) => setNewEventDesc(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onAddEvent(era.id); }}
          />
          <button
            className="library-page-action primary"
            onClick={() => onAddEvent(era.id)}
            disabled={!newEventName.trim()}
          >
            Add
          </button>
          <button
            className="library-page-action"
            onClick={() => {
              setAddingToEra(null);
              setNewEventName("");
              setNewEventDesc("");
            }}
          >
            Cancel
          </button>
        </div>
      )}

      {events.length === 0 ? (
        <p className="master-timeline-empty">No events in this era yet.</p>
      ) : (
        <ol className="master-timeline-events">
          {events.map((event) => (
            <EventItem key={event.id} event={event} />
          ))}
        </ol>
      )}
    </section>
  );
}
