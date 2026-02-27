import os from "os";

export type GemmaModel = "gemma3:1b" | "gemma3:4b" | "gemma3n:e4b" | "gemma3:12b" | "gemma3:27b";

/**
 * Dedicated embedding model — kept separate from the generative model.
 * nomic-embed-text is a lightweight (274 M param) model that produces
 * high-quality 768-dim vectors and runs fast on CPU+Metal.
 */
export const EMBED_MODEL = "nomic-embed-text";

export interface SystemInfo {
  ramGB: number;
  model: GemmaModel;
  /** Ollama model used exclusively for vector embeddings. */
  embedModel: string;
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
 * Select the appropriate Gemma model based on available RAM.
 *
 * Thresholds account for ~6–8 GB of headroom consumed by macOS + browser:
 *
 *  < 12 GB  → gemma3:1b       (~1 GB VRAM)  light drafting
 *  12–23 GB → gemma3:4b       (~6.5 GB VRAM) proven safe on 16 GB M-series
 *  24–31 GB → gemma3n:e4b     (~3 GB VRAM)  MatFormer 4B, slightly outperforms
 *                                             gemma3:4b, safe upgrade for 24 GB
 *  32–47 GB → gemma3:12b      (~11 GB VRAM) requires ≥32 GB to avoid swap
 *  48+ GB   → gemma3:27b      (~22 GB VRAM)
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
  } else if (ramGB < 32) {
    // gemma3n:e4b (MatFormer): ~3 GB VRAM; safer than gemma3:12b on 24 GB machines
    // where browser + OS already consumes ~8 GB, leaving ~16 GB — not enough for 12b.
    model = "gemma3n:e4b";
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
    embedModel: EMBED_MODEL,
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
