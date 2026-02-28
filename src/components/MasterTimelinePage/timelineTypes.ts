import type { Era, Event } from "@/lib/types";

export interface EraWithEvents {
  era: Era;
  events: Event[];
}
