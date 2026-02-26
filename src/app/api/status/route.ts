import { getSystemInfo } from "@/lib/system";
import { isModelAvailable, checkOllamaHealth } from "@/lib/ollama";
import { NextResponse } from "next/server";

export interface StartupStatus {
  ram: number;
  model: string;
  contextWindow: number;
  mode: string;
  ollamaReady: boolean;
  modelAvailable: boolean;
  error?: string;
}

export async function GET() {
  try {
    const systemInfo = getSystemInfo();
    const ollamaReady = await checkOllamaHealth();
    let modelAvailable = false;

    if (ollamaReady) {
      modelAvailable = await isModelAvailable(systemInfo.model);
    }

    const status: StartupStatus = {
      ram: systemInfo.ramGB,
      model: systemInfo.model,
      contextWindow: systemInfo.contextWindow,
      mode: systemInfo.mode,
      ollamaReady,
      modelAvailable,
    };

    if (!ollamaReady) {
      status.error =
        "Ollama is not running. Start it with: ollama serve (in a separate terminal)";
    } else if (!modelAvailable) {
      status.error = `Model ${systemInfo.model} not found. Pull it with: ollama pull ${systemInfo.model}`;
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
