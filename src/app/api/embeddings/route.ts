import { NextRequest, NextResponse } from "next/server";
import { getSystemInfo } from "@/lib/system";
import { OLLAMA_BASE_URL } from "@/lib/ollama";

interface EmbeddingRequestBody {
  input: string;
  model?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as EmbeddingRequestBody;
    const input = body?.input;

    if (!input || typeof input !== "string") {
      return NextResponse.json({ error: "`input` (string) is required" }, { status: 400 });
    }

    const systemInfo = getSystemInfo();
    // Default to the dedicated embedding model, not the generative model
    const model = typeof body.model === "string" ? body.model : systemInfo.embedModel;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        input,
        // nomic-embed-text defaults to 2048-token context in Ollama;
        // the model supports 8192 — explicitly request it so longer passages
        // are embedded correctly without silent truncation.
        options: { num_ctx: 8192 },
      }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Ollama embeddings error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const payload = await response.json();
    return NextResponse.json({ ...payload, model });
  } catch (error) {
    console.error("Embeddings API error:", error);
    return NextResponse.json({ error: "Failed to reach Ollama embeddings" }, { status: 502 });
  }
}
