"use client";

import type { Entry } from "@/lib/types";
import type { AddPinState } from "./mapTypes";

interface AddPinDialogProps {
  addPin: AddPinState;
  addPinEntryId: string;
  setAddPinEntryId: (v: string) => void;
  addPinIcon: string;
  setAddPinIcon: (v: string) => void;
  allEntries: Entry[];
  onConfirm: () => void;
  onCancel: () => void;
}

const PIN_ICONS = ["📍", "🏰", "⚔️", "🌊", "🌲", "🏔️", "🏙️", "⭐", "💀", "🔮"];

export function AddPinDialog({
  addPin,
  addPinEntryId,
  setAddPinEntryId,
  addPinIcon,
  setAddPinIcon,
  allEntries,
  onConfirm,
  onCancel,
}: AddPinDialogProps) {
  return (
    <div className="maps-add-pin-dialog" onClick={(e) => e.stopPropagation()}>
      <p className="maps-add-pin-title">
        Add Pin at ({addPin.x.toFixed(1)}%, {addPin.y.toFixed(1)}%)
      </p>
      <select
        className="canonical-doc-input"
        value={addPinEntryId}
        onChange={(e) => setAddPinEntryId(e.target.value)}
      >
        <option value="">— Select an entry —</option>
        {allEntries.map((e) => (
          <option key={e.id} value={e.id}>{e.name} ({e.entryType})</option>
        ))}
      </select>
      <select
        className="canonical-doc-input"
        value={addPinIcon}
        onChange={(e) => setAddPinIcon(e.target.value)}
      >
        {PIN_ICONS.map((ico) => (
          <option key={ico} value={ico}>{ico}</option>
        ))}
      </select>
      <div className="maps-add-pin-actions">
        <button
          className="library-page-action primary"
          disabled={!addPinEntryId}
          onClick={onConfirm}
        >
          Add Pin
        </button>
        <button className="library-page-action" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
