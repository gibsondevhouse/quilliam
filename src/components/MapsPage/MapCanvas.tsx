"use client";

import type { Media } from "@/lib/types";
import type { PinWithEntry, AddPinState } from "./mapTypes";
import { AddPinDialog } from "./AddPinDialog";
import type { Entry } from "@/lib/types";

interface MapCanvasProps {
  mapMedia: Media | null;
  pins: PinWithEntry[];
  addPin: AddPinState | null;
  setAddPin: (v: AddPinState | null) => void;
  addPinEntryId: string;
  setAddPinEntryId: (v: string) => void;
  addPinIcon: string;
  setAddPinIcon: (v: string) => void;
  allEntries: Entry[];
  onMapClick: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPinClick: (e: React.MouseEvent, row: PinWithEntry) => void;
  onConfirmPin: () => void;
}

export function MapCanvas({
  mapMedia,
  pins,
  addPin,
  setAddPin,
  addPinEntryId,
  setAddPinEntryId,
  addPinIcon,
  setAddPinIcon,
  allEntries,
  onMapClick,
  onPinClick,
  onConfirmPin,
}: MapCanvasProps) {
  return (
    <>
      <p className="maps-hint">
        Click anywhere on the map to add a pin. Click a pin to navigate to its entry.
      </p>
      <div
        className="maps-canvas"
        onClick={onMapClick}
        style={{ position: "relative", display: "inline-block", cursor: "crosshair" }}
      >
        {mapMedia?.storageUri ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mapMedia.storageUri}
            alt="Map"
            className="maps-image"
            draggable={false}
          />
        ) : (
          <div className="maps-placeholder">
            <span>No image uploaded — pins are still trackable by position.</span>
          </div>
        )}

        {pins.map(({ pin, entry }) => (
          <button
            key={pin.id}
            className="maps-pin"
            style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            title={entry ? `${entry.name} (${entry.entryType})` : pin.entryId}
            onClick={(e) => onPinClick(e, { pin, entry })}
          >
            {pin.icon ?? "📍"}
          </button>
        ))}

        {addPin && (
          <div
            className="maps-pin maps-pin--preview"
            style={{ left: `${addPin.x}%`, top: `${addPin.y}%`, pointerEvents: "none" }}
          >
            ✦
          </div>
        )}
      </div>

      {addPin && (
        <AddPinDialog
          addPin={addPin}
          addPinEntryId={addPinEntryId}
          setAddPinEntryId={setAddPinEntryId}
          addPinIcon={addPinIcon}
          setAddPinIcon={setAddPinIcon}
          allEntries={allEntries}
          onConfirm={onConfirmPin}
          onCancel={() => setAddPin(null)}
        />
      )}

      {pins.length > 0 && (
        <div className="maps-pin-list">
          <h3 className="entry-related-heading">Pins</h3>
          <ul className="entry-related-list">
            {pins.map(({ pin, entry }) => (
              <li key={pin.id} className="entry-related-row">
                <span>{pin.icon ?? "📍"}</span>
                <button
                  className="maps-pin-entry-btn"
                  onClick={() => onPinClick({ stopPropagation: () => undefined } as React.MouseEvent, { pin, entry })}
                >
                  {entry ? `${entry.name} (${entry.entryType})` : pin.entryId}
                </button>
                <span className="entry-related-badge">
                  ({pin.x.toFixed(0)}%, {pin.y.toFixed(0)}%)
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
