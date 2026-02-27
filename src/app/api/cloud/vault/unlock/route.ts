import { NextRequest, NextResponse } from "next/server";
import { CLOUD_SESSION_COOKIE, unlockVault } from "@/lib/cloud/vault";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as { passphrase?: string };
    const passphrase = body.passphrase?.trim() ?? "";

    if (!passphrase) {
      return NextResponse.json({ error: "`passphrase` is required." }, { status: 400 });
    }

    const { sessionId, status } = await unlockVault(passphrase);

    const response = NextResponse.json(status);
    response.cookies.set({
      name: CLOUD_SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 8,
    });

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to unlock cloud vault.",
      },
      { status: 401 },
    );
  }
}
