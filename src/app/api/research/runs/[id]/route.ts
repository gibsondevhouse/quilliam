import { NextRequest, NextResponse } from "next/server";
import { getResearchRunManager } from "@/lib/research/manager";

export const runtime = "nodejs";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const run = await getResearchRunManager().get(id);
    if (!run) {
      return NextResponse.json({ error: "Research run not found." }, { status: 404 });
    }
    return NextResponse.json({ run });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch research run." },
      { status: 500 },
    );
  }
}
