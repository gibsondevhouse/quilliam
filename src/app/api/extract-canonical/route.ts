/**
 * /api/extract-canonical — server-side canonical entity extraction endpoint.
 *
 * Accepts prose or research text plus an optional snapshot of `existingDocs`
 * from the client's IndexedDB store.  When `existingDocs` is provided the
 * newer `extractPatches` pipeline is used, which:
 *   • matches extracted entities against existing docs by name / alias
 *   • returns up to two patches: one auto-commit (high confidence) and one
 *     review patch (lower confidence) — see `src/lib/patchExtractor.ts`
 *
 * When `existingDocs` is omitted the legacy `extractCanonical` function is
 * used for backward-compat, returning a single pending patch.
 *
 * The patch(es) are returned as JSON — the client persists them in the
 * `patches` IDB store and surfaces the count in the Build Feed badge.
 *
 * The caller is responsible for:
 *   - Calling `applyPatch(patch, store)` for each patch where `autoCommit === true`
 *   - Calling `store.addPatch(patch)` for each patch where `autoCommit === false`
 *
 * All processing is local (Ollama on localhost). No external API calls are made.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractCanonical, extractPatches } from "@/lib/patchExtractor";
import type { Entry, SourceRef } from "@/lib/types";

/** Maps the legacy API sourceType field to a SourceRef.kind value. */
function toSourceKind(raw: string | undefined): SourceRef["kind"] {
  switch (raw) {
    case "chat":     return "chat_message";
    case "research": return "research_artifact";
    default:         return "manual";
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      text?: string;
      sourceType?: string;
      sourceId?: string;
      /** Optional snapshot of entry records from the client IDB store. */
      existingEntries?: Entry[];
      /** Backward compatibility alias, removed after imp002 cutover. */
      existingDocs?: Entry[];
    };

    const { text, sourceType, sourceId = "unknown", existingEntries, existingDocs } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const trimmedText = text.trim();

    const candidates = Array.isArray(existingEntries)
      ? existingEntries
      : Array.isArray(existingDocs)
        ? existingDocs
        : null;

    if (Array.isArray(candidates)) {
      // New pipeline: name-aware multi-patch extraction
      const sourceRef: SourceRef = { kind: toSourceKind(sourceType), id: sourceId };
      const patches = await extractPatches(trimmedText, candidates, sourceRef);
      return NextResponse.json({ patches });
    }

    // Legacy path: single-patch extraction (no existing-doc context)
    const patch = await extractCanonical(trimmedText, toSourceKind(sourceType), sourceId);
    return NextResponse.json({ patches: patch.operations.length > 0 ? [patch] : [] });
  } catch (error) {
    console.error("Canonical extraction error:", error);
    return NextResponse.json(
      { error: "Extraction failed — ensure Ollama is running." },
      { status: 502 },
    );
  }
}
