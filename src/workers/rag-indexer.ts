/// <reference lib="webworker" />

import { hashFragment } from "@/lib/rag/hasher";
import { estimateTokenCount } from "@/lib/rag/hierarchy";
import type {
  HashBatchRequest,
  HashBatchResultMessage,
  HashRequest,
  HashResultMessage,
  RagWorkerRequest,
} from "@/lib/rag/messages";

const ctx: DedicatedWorkerGlobalScope = self as unknown as DedicatedWorkerGlobalScope;

async function handleHash(request: HashRequest): Promise<HashResultMessage> {
  const { fragmentId, content } = request.fragment;
  const contentHash = await hashFragment(content);
  const tokenCount = estimateTokenCount(content);

  return {
    type: "hash-result",
    result: { fragmentId, contentHash, tokenCount },
  };
}

async function handleHashBatch(request: HashBatchRequest): Promise<HashBatchResultMessage> {
  const results = await Promise.all(
    request.fragments.map(async ({ fragmentId, content }) => {
      const contentHash = await hashFragment(content);
      const tokenCount = estimateTokenCount(content);
      return { fragmentId, contentHash, tokenCount };
    })
  );

  return {
    type: "hash-batch-result",
    results,
  };
}

ctx.onmessage = async (event: MessageEvent<RagWorkerRequest>) => {
  const data = event.data;

  switch (data.type) {
    case "hash": {
      const message = await handleHash(data);
      ctx.postMessage(message);
      break;
    }
    case "hash-batch": {
      const message = await handleHashBatch(data);
      ctx.postMessage(message);
      break;
    }
    default:
      // Ignore unknown messages to keep the worker resilient
      break;
  }
};
