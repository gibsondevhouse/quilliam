import { NextRequest, NextResponse } from "next/server";
import { getSessionIdFromRequest, getVaultStatus, initVault } from "@/lib/cloud/vault";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const sessionId = getSessionIdFromRequest(request);
    const status = await getVaultStatus(sessionId);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to read cloud vault status.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
    const passphrase = body.passphrase?.trim() ?? "";
    if (!passphrase) {
      return NextResponse.json(
        { error: "`passphrase` is required to initialize the cloud vault." },
        { status: 400 },
      );
    }

    const status = await initVault(passphrase);
    return NextResponse.json(status);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to initialize cloud vault.",
      },
      { status: 500 },
    );
  }
}
