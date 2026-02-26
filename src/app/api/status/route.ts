import { getSystemInfo } from "@/lib/system";
import { isModelAvailable, checkOllamaHealth } from "@/lib/ollama";
import { NextResponse } from "next/server";

export interface StartupStatus {
  ram: number;
  model: string;
  /** Dedicated Ollama model used for vector embeddings (e.g. nomic-embed-text). */
  embedModel: string;
  contextWindow: number;
  mode: string;
  ollamaReady: boolean;
  modelAvailable: boolean;
  /** Whether the dedicated embedding model is pulled and available. */
  embedModelAvailable: boolean;
  error?: string;
}

export async function GET() {
  try {
    const systemInfo = getSystemInfo();
    const ollamaReady = await checkOllamaHealth();
    let modelAvailable = false;
    let embedModelAvailable = false;

    if (ollamaReady) {
      [modelAvailable, embedModelAvailable] = await Promise.all([
        isModelAvailable(systemInfo.model),
        isModelAvailable(systemInfo.embedModel),
      ]);
    }

    const status: StartupStatus = {
      ram: systemInfo.ramGB,
      model: systemInfo.model,
      embedModel: systemInfo.embedModel,
      contextWindow: systemInfo.contextWindow,
      mode: systemInfo.mode,
      ollamaReady,
      modelAvailable,
      embedModelAvailable,
    };

    if (!ollamaReady) {
      status.error =
        "Ollama is not running. Start it with: ollama serve (in a separate terminal)";
    } else if (!modelAvailable) {
      status.error = `Model ${systemInfo.model} not found. Pull it with: ollama pull ${systemInfo.model}`;
    } else if (!embedModelAvailable) {
      status.error = `Embedding model not found. Pull it with: ollama pull ${systemInfo.embedModel}`;
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error("Error fetching startup status:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch startup status",
        ollamaReady: false,
        modelAvailable: false,
      },
      { status: 500 }
    );
  }
}
