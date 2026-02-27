import { NextRequest, NextResponse } from "next/server";
import {
  deleteProviderKey,
  putProviderKey,
  requireUnlockedSession,
  type CloudProvider,
} from "@/lib/cloud/vault";

export const runtime = "nodejs";

function isProvider(value: string): value is CloudProvider {
  return value === "anthropic" || value === "tavily";
}

export async function PUT(request: NextRequest) {
  try {
    const { sessionId } = requireUnlockedSession(request);
    const body = (await request.json().catch(() => ({}))) as { provider?: string; apiKey?: string };

    if (!body.provider || !isProvider(body.provider)) {
      return NextResponse.json({ error: "`provider` must be `anthropic` or `tavily`." }, { status: 400 });
    }

    const apiKey = body.apiKey?.trim() ?? "";
    if (!apiKey) {
      return NextResponse.json({ error: "`apiKey` is required." }, { status: 400 });
    }

    const status = await putProviderKey(sessionId, body.provider, apiKey);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save provider key." },
      { status: 401 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { sessionId } = requireUnlockedSession(request);
    const body = (await request.json().catch(() => ({}))) as { provider?: string };

    if (!body.provider || !isProvider(body.provider)) {
      return NextResponse.json({ error: "`provider` must be `anthropic` or `tavily`." }, { status: 400 });
    }

    const status = await deleteProviderKey(sessionId, body.provider);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to remove provider key." },
      { status: 401 },
    );
  }
}
