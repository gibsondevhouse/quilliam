import { NextRequest } from "next/server";
import { getSystemInfo } from "@/lib/system";

const OLLAMA_BASE = process.env.OLLAMA_API_URL || "http://localhost:11434";

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const systemInfo = getSystemInfo();

    const response = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: systemInfo.model,
        messages,
        stream: true,
      }),
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `Ollama error: ${response.statusText}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response through
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({ error: "Failed to reach Ollama" }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
