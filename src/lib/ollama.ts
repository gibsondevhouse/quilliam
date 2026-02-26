/**
 * Ollama REST API Client
 * All calls are server-to-server (Next.js → localhost:11434)
 * Keeps user data off-client and maintains zero-knowledge privacy
 */

const OLLAMA_BASE = process.env.OLLAMA_API_URL || "http://localhost:11434";
const OLLAMA_API = `${OLLAMA_BASE}/api`;

export interface OllamaModel {
  name: string;
  model: string;
  modified_at: string;
  size: number;
  digest: string;
}

export interface OllamaTagsResponse {
  models: OllamaModel[];
}

/**
 * Ping Ollama to check availability and fetch available models
 */
export async function pingOllama(): Promise<OllamaTagsResponse> {
  try {
    const response = await fetch(`${OLLAMA_API}/tags`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Error pinging Ollama:", error);
    throw new Error("Ollama is not available at " + OLLAMA_BASE);
  }
}

/**
 * Check if a specific model is available in Ollama
 */
export async function isModelAvailable(modelName: string): Promise<boolean> {
  try {
    const { models } = await pingOllama();
    return models.some((m) => m.model === modelName || m.name === modelName);
  } catch {
    return false;
  }
}

/**
 * Pull a model from Ollama registry (downloads if not present)
 * Returns a readable stream of pull progress
 */
export async function pullModel(
  modelName: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(`${OLLAMA_API}/pull`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: modelName, stream: true }),
  });

  if (!response.ok) {
    throw new Error(`Failed to pull model: ${response.statusText}`);
  }

  if (!response.body) {
    throw new Error("No response body from pull request");
  }

  return response.body;
}

/**
 * Check Ollama health/readiness
 */
export async function checkOllamaHealth(): Promise<boolean> {
  try {
    await pingOllama();
    return true;
  } catch {
    return false;
  }
}
