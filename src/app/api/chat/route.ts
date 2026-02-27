import { NextRequest } from "next/server";
import { getSystemInfo } from "@/lib/system";
import { OLLAMA_BASE_URL } from "@/lib/ollama";

export async function POST(request: NextRequest) {
  try {
    const { messages } = await request.json();
    const systemInfo = getSystemInfo();

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: systemInfo.model,
        messages,
        stream: true,
        keep_alive: "24h",
        options: {
          num_batch: 128,
        },
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
