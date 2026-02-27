export interface AnthropicRequest {
  apiKey: string;
  model: string;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AnthropicUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface AnthropicResponse {
  text: string;
  usage: AnthropicUsage;
}

interface RawAnthropicMessageResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

export async function callAnthropicText(request: AnthropicRequest): Promise<AnthropicResponse> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": request.apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: request.model,
      system: request.system,
      messages: [{ role: "user", content: request.user }],
      max_tokens: request.maxTokens ?? 1800,
      temperature: request.temperature ?? 0.2,
    }),
  });

  if (!response.ok) {
    const msg = await response.text().catch(() => response.statusText);
    throw new Error(`Anthropic request failed (${response.status}): ${msg}`);
  }

  const data = (await response.json()) as RawAnthropicMessageResponse;
  const text =
    data.content
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim() ?? "";

  return {
    text,
    usage: {
      inputTokens: data.usage?.input_tokens ?? 0,
      outputTokens: data.usage?.output_tokens ?? 0,
    },
  };
}

export function extractJsonObject<T>(raw: string): T | null {
  const direct = raw.trim();
  try {
    return JSON.parse(direct) as T;
  } catch {
    // continue
  }

  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(raw.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
