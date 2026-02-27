import { NextRequest, NextResponse } from "next/server";
import { runAssistedCloud } from "@/lib/cloud/assist";
import { requireUnlockedSession } from "@/lib/cloud/vault";

export const runtime = "nodejs";

interface AssistRequestBody {
  query: string;
  context?: string;
  messages?: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  providerConfig?: {
    anthropicModel?: string;
    tavilyEnabled?: boolean;
  };
  budget?: {
    maxUsd?: number;
    maxInputTokens?: number;
    maxOutputTokens?: number;
    maxMinutes?: number;
    maxSources?: number;
  };
}

export async function POST(request: NextRequest) {
  try {
    const { session } = requireUnlockedSession(request);
    if (!session.keys.anthropicApiKey) {
      return NextResponse.json(
        {
          error: "Anthropic API key is not configured. Add it in Systems settings.",
        },
        { status: 400 },
      );
    }

    const body = (await request.json()) as AssistRequestBody;
    if (!body.query || !body.query.trim()) {
      return NextResponse.json({ error: "`query` is required." }, { status: 400 });
    }

    const result = await runAssistedCloud(
      {
        query: body.query,
        context: body.context ?? "",
        messages: body.messages ?? [],
        providerConfig: body.providerConfig,
        budget: body.budget,
      },
      session.keys.anthropicApiKey,
    );

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Assisted cloud request failed.",
      },
      { status: 500 },
    );
  }
}
