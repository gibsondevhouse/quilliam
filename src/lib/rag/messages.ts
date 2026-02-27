/**
 * Message contracts shared between the main thread and the rag-indexer worker.
 */

export interface HashFragmentPayload {
  fragmentId: string;
  content: string;
}

export interface HashRequest {
  type: "hash";
  fragment: HashFragmentPayload;
}

export interface HashBatchRequest {
  type: "hash-batch";
  fragments: HashFragmentPayload[];
}

/** A single item to rank: its id plus its pre-hydrated embedding vector. */
export interface RankItem {
  id: string;
  vector: Float32Array;
}

/**
 * Ask the worker to rank `items` by cosine similarity to `queryVector`
 * and return the top `limit` results.
 *
 * Arrays use structured clone (not Transferable) so the main thread retains
 * the vectors for potential follow-up use.
 */
export interface RankSimilarityRequest {
  type: "rank-similarity";
  /** Unique identifier for correlating the response to this request. */
  requestId: string;
  queryVector: Float32Array;
  items: RankItem[];
  limit: number;
}

export type RagWorkerRequest = HashRequest | HashBatchRequest | RankSimilarityRequest;

export interface HashResult {
  fragmentId: string;
  contentHash: string;
  tokenCount: number;
}

export interface HashResultMessage {
  type: "hash-result";
  result: HashResult;
}

export interface HashBatchResultMessage {
  type: "hash-batch-result";
  results: HashResult[];
}

export interface RankResult {
  id: string;
  score: number;
}

export interface RankSimilarityResultMessage {
  type: "rank-similarity-result";
  requestId: string;
  results: RankResult[];
}

export type RagWorkerResponse = HashResultMessage | HashBatchResultMessage | RankSimilarityResultMessage;
