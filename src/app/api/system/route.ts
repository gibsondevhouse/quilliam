import { getSystemInfo } from "@/lib/system";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const systemInfo = getSystemInfo();
    return NextResponse.json(systemInfo);
  } catch (error) {
    console.error("Error fetching system info:", error);
    return NextResponse.json(
      { error: "Failed to fetch system information" },
      { status: 500 }
    );
  }
}
