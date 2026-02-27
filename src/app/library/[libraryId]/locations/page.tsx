"use client";

import { useLibraryContext } from "@/lib/context/LibraryContext";
import { LocationEditor } from "@/components/Editor/LocationEditor";

export default function LocationsPage() {
  const lib = useLibraryContext();
  const active = lib.locations.find((l) => l.id === lib.activeLocationId);
  const activeKey = active ? `location:${active.name.trim().toLowerCase()}` : null;
  const activePending = activeKey
    ? (lib.changeSets[activeKey] ?? []).filter((cs) => cs.status === "pending")
    : [];
  const activeDraft = activeKey ? lib.entityDrafts[activeKey] : undefined;

  return (
    <div className="library-page locations-page split-page">
      <div className="split-page-list">
        <div className="library-page-header">
          <h2>Locations</h2>
          <button className="library-page-action" onClick={() => lib.addLocation()}>+ Add</button>
        </div>
        {lib.locations.length === 0 ? (
          <div className="library-page-empty">
            <p>No locations yet.</p>
            <button className="library-page-action primary" onClick={() => lib.addLocation()}>
              Add your first location
            </button>
          </div>
        ) : (
          <ul className="library-item-list">
            {lib.locations.map((l) => {
              const key = `location:${l.name.trim().toLowerCase()}`;
              const hasPending = (lib.changeSets[key] ?? []).some((cs) => cs.status === "pending");
              return (
                <li key={l.id} className="library-item-row">
                  <button
                    className={`library-item-btn ${lib.activeLocationId === l.id ? "active" : ""}`}
                    onClick={() => lib.selectLocation(l.id)}
                  >
                    <span className="library-item-icon">📍</span>
                    <div className="library-item-info">
                      <span className="library-item-title">{l.name || "Unnamed"}</span>
                    </div>
                    {hasPending && <span className="library-item-pending-dot" title="AI draft pending" />}
                  </button>
                  <button
                    className="library-item-delete"
                    onClick={(e) => { e.stopPropagation(); lib.deleteLocation(l.id); }}
                    title="Delete"
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <div className="split-page-editor">
        {active ? (
          <LocationEditor
            key={active.id}
            location={active}
            onChange={lib.updateLocation}
            draftText={activeDraft}
            pendingChangeSets={activePending}
            onAcceptHunk={lib.acceptChange}
            onRejectHunk={lib.rejectChange}
            onAcceptAll={activeKey ? () => lib.acceptAllChanges(activeKey) : undefined}
            onRejectAll={activeKey ? () => lib.rejectAllChanges(activeKey) : undefined}
          />
        ) : (
          <div className="library-page-empty">
            <p>Select a location to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
