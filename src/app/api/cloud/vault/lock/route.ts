import { NextRequest, NextResponse } from "next/server";
import { CLOUD_SESSION_COOKIE, getSessionIdFromRequest, lockVaultSession } from "@/lib/cloud/vault";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const sessionId = getSessionIdFromRequest(request);
  lockVaultSession(sessionId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: CLOUD_SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
  });

  return response;
}
