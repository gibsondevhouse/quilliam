/**
 * changeSets.ts — TypeScript port of the Swift LineEdit / ChangeSet model.
 *
 * Mirrors Quilliam/Models/LineEdit.swift so both platforms share the same
 * conceptual edit lifecycle: pending → accepted | rejected.
 */

// ---------------------------------------------------------------------------
// File targeting — which document does an edit apply to?
// ---------------------------------------------------------------------------

export type FileTarget =
  | { kind: "active" }
  | { kind: "character"; name: string }
  | { kind: "location"; name: string }
  | { kind: "world"; key: string };

// ---------------------------------------------------------------------------
// Line-level edit operations (0-based indices, exclusive upper bound)
// ---------------------------------------------------------------------------

export type LineEdit =
  | { type: "replace"; start: number; end: number; newLines: string[] }
  | { type: "insert"; afterIndex: number; newLines: string[] }
  | { type: "delete"; start: number; end: number };

// ---------------------------------------------------------------------------
// Change lifecycle
// ---------------------------------------------------------------------------

export type ChangeStatus = "pending" | "accepted" | "rejected";

/** Visual decoration for a single editor line computed from pending ChangeSets. */
export type LineChangeState = "unchanged" | "added" | "modified" | "deleted";

export const LINE_CHANGE_COLORS: Record<LineChangeState, string> = {
  unchanged: "transparent",
  added: "rgba(34, 197, 94, 0.25)",       // green-500 / 25%
  modified: "rgba(234, 179, 8, 0.25)",    // yellow-500 / 25%
  deleted: "rgba(239, 68, 68, 0.20)",     // red-500 / 20%
};

/** Monaco CSS class names used for editor decorations. */
export const LINE_CHANGE_CLASSES: Record<LineChangeState, string> = {
  unchanged: "",
  added: "ql-line-added",
  modified: "ql-line-modified",
  deleted: "ql-line-deleted",
};

/**
 * A group of LineEdit operations produced by a single AI response turn,
 * targeting a specific document or entity.
 */
export interface ChangeSet {
  id: string;
  edits: LineEdit[];
  fileTarget: FileTarget;
  status: ChangeStatus;
  /** Raw commentary / explanation from the AI response. */
  commentary: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Apply an array of LineEdits to a string, returning the patched string.
 * Edits are applied in descending order by start position to preserve indices.
 */
export function applyEdits(text: string, edits: LineEdit[]): string {
  const lines = text.split("\n");

  // Sort descending so later edits don't shift earlier indices
  const sorted = [...edits].sort((a, b) => {
    const aStart = a.type === "insert" ? a.afterIndex + 1 : a.start;
    const bStart = b.type === "insert" ? b.afterIndex + 1 : b.start;
    return bStart - aStart;
  });

  for (const edit of sorted) {
    if (edit.type === "replace") {
      lines.splice(edit.start, edit.end - edit.start, ...edit.newLines);
    } else if (edit.type === "insert") {
      const at = Math.max(0, Math.min(edit.afterIndex + 1, lines.length));
      lines.splice(at, 0, ...edit.newLines);
    } else if (edit.type === "delete") {
      lines.splice(edit.start, edit.end - edit.start);
    }
  }

  return lines.join("\n");
}

/**
 * Compute per-line change states from a set of pending ChangeSets.
 * Returns an array whose length matches the number of lines in `text`.
 */
export function computeLineStates(
  text: string,
  pendingSets: ChangeSet[]
): LineChangeState[] {
  const lines = text.split("\n");
  const states: LineChangeState[] = new Array(lines.length).fill("unchanged");

  for (const cs of pendingSets) {
    if (cs.status !== "pending") continue;
    for (const edit of cs.edits) {
      if (edit.type === "replace") {
        for (let i = edit.start; i < Math.min(edit.end, states.length); i++) {
          states[i] = "modified";
        }
        // Extra inserted lines beyond the replaced range
        const extra = edit.newLines.length - (edit.end - edit.start);
        if (extra > 0) {
          const at = Math.min(edit.end, states.length);
          states.splice(at, 0, ...new Array(extra).fill("added") as LineChangeState[]);
        }
      } else if (edit.type === "insert") {
        const at = Math.min(Math.max(edit.afterIndex + 1, 0), states.length);
        states.splice(at, 0, ...new Array(edit.newLines.length).fill("added") as LineChangeState[]);
      } else if (edit.type === "delete") {
        for (let i = edit.start; i < Math.min(edit.end, states.length); i++) {
          states[i] = "deleted";
        }
      }
    }
  }

  return states;
}

/** Return a stable document key string from a FileTarget. */
export function fileTargetKey(target: FileTarget): string {
  if (target.kind === "active") return "__active__";
  if (target.kind === "character") return `character:${target.name.trim().toLowerCase()}`;
  if (target.kind === "location") return `location:${target.name.trim().toLowerCase()}`;
  return `world:${target.key.trim().toLowerCase()}`;
}
