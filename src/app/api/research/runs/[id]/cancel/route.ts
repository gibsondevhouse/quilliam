import { NextRequest, NextResponse } from "next/server";
import { getResearchRunManager } from "@/lib/research/manager";
import { requireUnlockedSession } from "@/lib/cloud/vault";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireUnlockedSession(request);
    const { id } = await params;
    const run = await getResearchRunManager().cancel(id);
    if (!run) {
      return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel research run." },
      { status: 500 },
    );
  }
}
