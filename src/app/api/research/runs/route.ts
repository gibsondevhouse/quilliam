import { NextRequest, NextResponse } from "next/server";
import { getResearchRunManager } from "@/lib/research/manager";
import { requireUnlockedSession } from "@/lib/cloud/vault";

export const runtime = "nodejs";

interface CreateRunBody {
  libraryId: string;
  query: string;
  context?: string;
  budget?: {
    maxUsd?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    maxMinutes?: number;
    maxSources?: number;
  };
  providerConfig?: {
    anthropicModel?: string;
    tavilyEnabled?: boolean;
  };
}

export async function GET(request: NextRequest) {
  try {
    const libraryId = request.nextUrl.searchParams.get("libraryId") ?? undefined;
    const runs = await getResearchRunManager().list(libraryId);
    return NextResponse.json({ runs });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to list research runs." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session } = requireUnlockedSession(request);

    const body = (await request.json()) as CreateRunBody;
    if (!body.libraryId || !body.query?.trim()) {
      return NextResponse.json(
        { error: "`libraryId` and `query` are required." },
        { status: 400 },
      );
    }

    const run = await getResearchRunManager().create(
      {
        libraryId: body.libraryId,
        query: body.query.trim(),
        context: body.context ?? "",
        budget: body.budget,
        providerConfig: body.providerConfig,
      },
      session.keys,
    );

    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create research run." },
      { status: 500 },
    );
  }
}
