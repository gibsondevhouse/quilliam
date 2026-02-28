"use client";

import { EraSection } from "./EraSection";
import { useTimelineData } from "./hooks/useTimelineData";

export function MasterTimelinePage() {
  const {
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
  } = useTimelineData();

  if (loading) {
    return (
      <div className="library-page">
        <p className="library-loading">Loading timeline…</p>
      </div>
    );
  }

  if (!masterTimeline) {
    return (
      <div className="library-page">
        <div className="library-page-header">
          <h2>Master Timeline</h2>
        </div>
        <div className="library-page-empty">
          <p>No master timeline yet. Create one to start planning eras and events.</p>
          <button
            className="library-page-action primary"
            onClick={() => void handleCreateTimeline()}
          >
            Create Master Timeline
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="library-page master-timeline-page">
      <div className="library-page-header">
        <h2>Master Timeline</h2>
        <div className="master-timeline-header-actions">
          <input
            className="canonical-doc-input"
            placeholder="New era name…"
            value={newEraName}
            onChange={(e) => setNewEraName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void handleAddEra(); }}
            style={{ width: 180 }}
          />
          <button
            className="library-page-action"
            onClick={() => void handleAddEra()}
            disabled={!newEraName.trim()}
          >
            + Add Era
          </button>
        </div>
      </div>

      {eraData.length === 0 ? (
        <div className="library-page-empty">
          <p>No eras yet. Add your first era using the field above.</p>
        </div>
      ) : (
        <div className="master-timeline-eras">
          {eraData.map(({ era, events }) => (
            <EraSection
              key={era.id}
              era={era}
              events={events}
              addingToEra={addingToEra}
              setAddingToEra={setAddingToEra}
              newEventName={newEventName}
              setNewEventName={setNewEventName}
              newEventType={newEventType}
              setNewEventType={setNewEventType}
              newEventDesc={newEventDesc}
              setNewEventDesc={setNewEventDesc}
              onAddEvent={(eraId) => void handleAddEvent(eraId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
