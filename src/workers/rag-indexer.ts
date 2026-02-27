/// <reference lib="webworker" />

import { hashFragment } from "@/lib/rag/hasher";
import { estimateTokenCount } from "@/lib/rag/hierarchy";
import { cosineSimilarity } from "@/lib/rag/search";
import type {
  HashBatchRequest,
  HashBatchResultMessage,
  HashRequest,
  HashResultMessage,
  RagWorkerRequest,
  RankSimilarityRequest,
  RankSimilarityResultMessage,
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

function handleRankSimilarity(request: RankSimilarityRequest): RankSimilarityResultMessage {
  const { requestId, queryVector, items, limit } = request;
  const scored = items
    .map(({ id, vector }) => ({ id, score: cosineSimilarity(queryVector, vector) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, limit));
  return { type: "rank-similarity-result", requestId, results: scored };
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
    case "rank-similarity": {
      const message = handleRankSimilarity(data);
      ctx.postMessage(message);
      break;
    }
    default:
      // Ignore unknown messages to keep the worker resilient
      break;
  }
};
