import { NextRequest } from "next/server";
import { getResearchRunManager } from "@/lib/research/manager";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const manager = getResearchRunManager();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const push = (event: string, payload: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\n`));
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      const current = await manager.get(id);
      if (current) {
        push("run", current);
      } else {
        push("error", { error: "Research run not found." });
        controller.close();
        return;
      }

      const unsubscribe = manager.subscribe(id, (run) => {
        push("run", run);
        if (run.status === "completed" || run.status === "cancelled" || run.status === "failed" || run.status === "budget_exceeded") {
          clearInterval(heartbeat);
          unsubscribe();
          controller.close();
        }
      });

      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keep-alive\n\n"));
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
