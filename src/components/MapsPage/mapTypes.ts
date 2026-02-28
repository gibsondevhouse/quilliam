import type { Entry, EntryType, MapPin } from "@/lib/types";

export const PIN_ENTRY_TYPES: EntryType[] = [
  "location", "organization", "faction", "culture",
  "character", "item", "system", "magic_system",
];

export interface PinWithEntry {
  pin: MapPin;
  entry?: Entry;
}

export interface AddPinState {
  x: number;
  y: number;
}
