/**
 * /api/extract-canonical — server-side canonical entity extraction endpoint.
 *
 * Accepts prose or research text, runs it through the local Ollama model via
 * `extractCanonical`, and returns a `CanonicalPatch` for client-side IDB storage.
 *
 * The patch is returned as JSON — the client persists it in the `patches` store
 * and surfaces the count in the Build Feed badge.
 *
 * All processing is local (Ollama on localhost). No external API calls are made.
 */

import { NextRequest, NextResponse } from "next/server";
import { extractCanonical } from "@/lib/patchExtractor";
import type { CanonicalPatch } from "@/lib/types";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      text?: string;
      sourceType?: CanonicalPatch["sourceType"];
      sourceId?: string;
    };

    const { text, sourceType = "manual", sourceId = "unknown" } = body;

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    const patch = await extractCanonical(text.trim(), sourceType, sourceId);

    return NextResponse.json({ patch });
  } catch (error) {
    console.error("Canonical extraction error:", error);
    return NextResponse.json(
      { error: "Extraction failed — ensure Ollama is running." },
      { status: 502 },
    );
  }
}
