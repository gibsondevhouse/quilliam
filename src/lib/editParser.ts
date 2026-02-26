/**
 * editParser.ts — TypeScript port of Quilliam/Services/EditParser.swift
 *
 * Parses a streaming NDJSON response from /api/chat and yields two kinds of
 * events:
 *   - { type: "token", text }    — plain text to append to the chat bubble
 *   - { type: "editBlock", edit, fileTarget, commentary } — a parsed edit operation
 *
 * Edit fence format (1-based line numbers produced by the AI):
 *
 *   ```edit line=N-M
 *   replacement lines
 *   ```
 *
 *   ```edit line=N
 *   replacement for one line
 *   ```
 *
 *   ```edit line=N+
 *   lines to insert after line N  (N=0 = prepend)
 *   ```
 *
 *   ```edit line=N-M delete
 *   ```
 *
 *   ```edit line=N delete
 *   ```
 *
 * The optional `file=` qualifier selects the target entity:
 *
 *   ```edit line=1 file=character:Elena
 *   ```edit line=1-3 file=location:Harbortown
 *   ```edit line=1 file=world:MagicSystem
 *
 * Omitting `file=` means the active chapter/document.
 */

import type { LineEdit, FileTarget } from "./changeSets";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface TokenEvent {
  type: "token";
  text: string;
}

export interface EditBlockEvent {
  type: "editBlock";
  edit: LineEdit;
  fileTarget: FileTarget;
  /** Accumulated plain-text commentary emitted before this edit block. */
  commentary: string;
}

export type ParsedEvent = TokenEvent | EditBlockEvent;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

type EditMode =
  | { kind: "replace"; start: number; end: number }      // 0-based, end exclusive
  | { kind: "insertAfter"; index: number }               // 0-based
  | { kind: "delete"; start: number; end: number };      // 0-based, end exclusive

interface ParserState {
  inEditBlock: boolean;
  editMode: EditMode | null;
  editLines: string[];
  fileTarget: FileTarget;
  lineBuffer: string;
  currentCommentary: string;
}

function freshState(): ParserState {
  return {
    inEditBlock: false,
    editMode: null,
    editLines: [],
    fileTarget: { kind: "active" },
    lineBuffer: "",
    currentCommentary: "",
  };
}

// ---------------------------------------------------------------------------
// Header parsing
// ---------------------------------------------------------------------------

/**
 * Parse the portion after "```edit " (e.g. "line=3-5 file=character:Elena").
 * Returns null if the format is not recognised (treated as regular text).
 */
function parseHeader(spec: string): { mode: EditMode; target: FileTarget } | null {
  let rest = spec.trim();

  // Extract optional file= qualifier
  let target: FileTarget = { kind: "active" };
  const fileMatch = rest.match(/\bfile=(\S+)/);
  if (fileMatch) {
    const raw = fileMatch[1];
    rest = rest.replace(fileMatch[0], "").trim();
    if (raw.startsWith("character:")) {
      target = { kind: "character", name: raw.slice("character:".length) };
    } else if (raw.startsWith("location:")) {
      target = { kind: "location", name: raw.slice("location:".length) };
    } else if (raw.startsWith("world:")) {
      target = { kind: "world", key: raw.slice("world:".length) };
    }
  }

  // Must start with "line="
  if (!rest.startsWith("line=")) return null;
  rest = rest.slice("line=".length);

  // Check for delete suffix
  const isDelete = rest.endsWith(" delete");
  if (isDelete) rest = rest.slice(0, rest.length - " delete".length).trim();

  // Insert: N+
  if (rest.endsWith("+")) {
    const n = parseInt(rest.slice(0, -1), 10);
    if (isNaN(n) || n < 0) return null;
    return { mode: { kind: "insertAfter", index: n - 1 }, target }; // 1-based → 0-based
  }

  // Range: N-M  or single: N
  const dashIdx = rest.indexOf("-");
  if (dashIdx !== -1) {
    const startN = parseInt(rest.slice(0, dashIdx), 10);
    const endN = parseInt(rest.slice(dashIdx + 1), 10);
    if (isNaN(startN) || isNaN(endN) || startN < 1 || endN < startN) return null;
    const s = startN - 1;          // 0-based
    const e = endN;                // 1-based inclusive → 0-based exclusive = endN
    const mode: EditMode = isDelete ? { kind: "delete", start: s, end: e } : { kind: "replace", start: s, end: e };
    return { mode, target };
  } else {
    const n = parseInt(rest, 10);
    if (isNaN(n) || n < 1) return null;
    const s = n - 1;
    const e = n; // single line exclusive
    const mode: EditMode = isDelete ? { kind: "delete", start: s, end: e } : { kind: "replace", start: s, end: e };
    return { mode, target };
  }
}

// ---------------------------------------------------------------------------
// Build LineEdit from mode + accumulated lines
// ---------------------------------------------------------------------------

function buildLineEdit(mode: EditMode, lines: string[]): LineEdit {
  if (mode.kind === "replace") {
    return { type: "replace", start: mode.start, end: mode.end, newLines: lines };
  } else if (mode.kind === "insertAfter") {
    return { type: "insert", afterIndex: mode.index, newLines: lines };
  } else {
    return { type: "delete", start: mode.start, end: mode.end };
  }
}

// ---------------------------------------------------------------------------
// Main parser: async generator over a ReadableStream
// ---------------------------------------------------------------------------

/**
 * Parse a streaming NDJSON response body from /api/chat.
 * Yields `ParsedEvent` objects as they become available.
 *
 * Usage:
 *   const resp = await fetch("/api/chat", { ... });
 *   for await (const event of parseEditStream(resp.body!)) { ... }
 */
export async function* parseEditStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<ParsedEvent> {
  const decoder = new TextDecoder();
  const reader = stream.getReader();
  const state = freshState();

  function* processLine(line: string): Generator<ParsedEvent> {
    if (state.inEditBlock) {
      // Accept closing fence with any surrounding whitespace
      if (line.trim() === "```") {
        // Closing fence — emit the edit block
        state.inEditBlock = false;
        if (state.editMode) {
          const edit = buildLineEdit(state.editMode, state.editLines);
          const commentary = state.currentCommentary;
          state.currentCommentary = "";
          state.editMode = null;
          state.editLines = [];
          yield { type: "editBlock", edit, fileTarget: state.fileTarget, commentary };
        }
      } else {
        state.editLines.push(line);
      }
    } else {
    // Also accept "```edit" without trailing space (model may omit it)
    if (line.startsWith("```edit")) {
      const spec = line.slice("```edit".length).trimStart();
        const parsed = parseHeader(spec);
        if (parsed) {
          state.inEditBlock = true;
          state.editMode = parsed.mode;
          state.fileTarget = parsed.target;
          state.editLines = [];
          // Don't yield — swallow the fence header
        } else {
          // Unrecognised fence → plain text
          const text = line + "\n";
          state.currentCommentary += text;
          yield { type: "token", text };
        }
      } else {
        const text = line + "\n";
        state.currentCommentary += text;
        yield { type: "token", text };
      }
    }
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // NDJSON chunk: may contain multiple JSON lines
      const chunk = decoder.decode(value, { stream: true });
      const jsonLines = chunk.split("\n").filter(Boolean);

      for (const jsonLine of jsonLines) {
        let messageContent = "";
        try {
          const parsed = JSON.parse(jsonLine) as { message?: { content?: string } };
          messageContent = parsed.message?.content ?? "";
        } catch {
          continue; // malformed chunk
        }

        if (!messageContent) continue;

        // Feed the content token into the line buffer
        state.lineBuffer += messageContent;

        // Drain all complete lines
        let nlIdx: number;
        while ((nlIdx = state.lineBuffer.indexOf("\n")) !== -1) {
          const line = state.lineBuffer.slice(0, nlIdx);
          state.lineBuffer = state.lineBuffer.slice(nlIdx + 1);
          yield* processLine(line);
        }
      }
    }

    // Flush trailing partial line
    if (state.lineBuffer) {
      if (state.inEditBlock) {
        state.editLines.push(state.lineBuffer);
      } else {
        yield { type: "token", text: state.lineBuffer };
      }
    }

    // If a fence was never closed (model truncated or malformed), emit what we have
    // as an editBlock so the edit still applies; also emit any saved commentary.
    if (state.inEditBlock && state.editMode && state.editLines.length > 0) {
      const edit = buildLineEdit(state.editMode, state.editLines);
      yield { type: "editBlock", edit, fileTarget: state.fileTarget, commentary: state.currentCommentary };
    } else if (state.inEditBlock) {
      // Fence opened but no valid mode/lines — recover any accumulated text as tokens
      const recovered = state.editLines.join("\n");
      if (recovered) yield { type: "token", text: recovered };
    }
  } finally {
    reader.releaseLock();
  }
}
