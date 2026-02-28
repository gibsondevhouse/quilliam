/**
 * Shared ID generation utilities.
 * Provides a consistent `makeId` factory used across components that need
 * locally-unique, time-ordered identifiers without a server round-trip.
 */

/**
 * Generate a locally-unique prefixed ID.
 * @example makeId("pin") → "pin_m5g3k2_ab4f7"
 */
export function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}
