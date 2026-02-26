import os from "os";

export type GemmaModel = "gemma3:1b" | "gemma3:4b" | "gemma3:12b" | "gemma3:27b";

export interface SystemInfo {
  ramGB: number;
  model: GemmaModel;
  contextWindow: number;
  mode: string;
}

/**
 * Get total system RAM in GB
 */
export function getSystemRAM(): number {
  return os.totalmem() / (1024 * 1024 * 1024);
}

/**
 * Select the appropriate Gemma 3 model based on available RAM
 * Uses conservative thresholds to leave room for system/browser overhead
 */
export function selectModel(ramGB: number): SystemInfo {
  let model: GemmaModel;
  let contextWindow: number;
  let mode: string;

  if (ramGB < 12) {
    model = "gemma3:1b";
    contextWindow = 32768;
    mode = "Drafting/Grammar";
  } else if (ramGB < 24) {
    model = "gemma3:4b";
    contextWindow = 131072;
    mode = "Multimodal/Research";
  } else if (ramGB < 48) {
    model = "gemma3:12b";
    contextWindow = 131072;
    mode = "Structural Editing";
  } else {
    model = "gemma3:27b";
    contextWindow = 131072;
    mode = "World-Building";
  }

  return {
    ramGB: Math.round(ramGB * 100) / 100,
    model,
    contextWindow,
    mode,
  };
}

/**
 * Get the full system configuration
 */
export function getSystemInfo(): SystemInfo {
  const ramGB = getSystemRAM();
  return selectModel(ramGB);
}
