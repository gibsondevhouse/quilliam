import { NextRequest } from "next/server";
import { getSystemInfo } from "@/lib/system";
import { OLLAMA_BASE_URL } from "@/lib/ollama";

/**
 * POST /api/chat — streaming Ollama proxy.
 *
 * ## Patch Proposal Pipeline (Plan 003)
 *
 * The route streams the Ollama response as-is (NDJSON, Content-Type: text/event-stream).
 * Canonical entity extraction happens **client-side** after the stream completes:
 *
 *   1. `useLocalChat` (Chat.tsx) assembles `fullContent` from the stream.
 *   2. When `onPatchesExtracted` is set, it POSTs `fullContent` to
 *      `/api/extract-canonical` with `existingDocs` from the client IDB store.
 *   3. `/api/extract-canonical` calls `extractPatches(text, existingDocs, sourceRef)`
 *      and returns `{ patches: CanonicalPatch[] }`.
 *   4. The caller separates auto-commit patches (confidence >= 0.85, autoCommit: true)
 *      from review patches and dispatches accordingly:
 *        - auto-commit → `applyPatch(patch, store)` (writes to IDB, marks "accepted")
 *        - review      → `store.addPatch(patch)`   (queued as "pending" in Build Feed)
 *
 * The `extractCanonical` flag below remains as an opt-in that appends an inline
 * extraction hint to the user message, causing the model to emit a
 * `canonical_extraction` JSON fence alongside its narrative reply.
 * This fence is stripped by the client before display; the text content is
 * forwarded to `/api/extract-canonical` as the extraction source.
 */

/**
 * Canonical extraction instruction appended to the system prompt when the
 * `extractCanonical` flag is set by the client.
 * The model is instructed to emit a fenced JSON block at the end of its reply
 * so the client can strip it out and feed it to the patchExtractor pipeline.
 */
const EXTRACTION_SUFFIX = `

---
After your narrative reply, output a fenced JSON block (delimited by triple backticks and the tag "canonical_extraction") listing any characters, locations, factions, or other narrative entities you mentioned, using this schema:
\`\`\`canonical_extraction
{ "entities": [ { "type": "<EntryType>", "name": "<name>", "summary": "<one sentence>" } ], "relationships": [ { "from": "<name>", "relType": "<edge label>", "to": "<name>" } ] }
\`\`\`
Omit the block entirely if no entities were mentioned.`;

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      messages: { role: string; content: string }[];
      extractCanonical?: boolean;
    };
    const { messages, extractCanonical = false } = body;
    const systemInfo = getSystemInfo();

    // When canonical extraction is requested, inject the extraction instruction
    // into the final user message.  We do not modify the system prompt directly
    // to preserve streaming parity with the plain chat path.
    const augmentedMessages = extractCanonical
      ? messages.map((m, i) =>
          i === messages.length - 1 && m.role === "user"
            ? { ...m, content: m.content + EXTRACTION_SUFFIX }
            : m
        )
      : messages;

    const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: systemInfo.model,
        messages: augmentedMessages,
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
