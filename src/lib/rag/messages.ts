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

export type RagWorkerRequest = HashRequest | HashBatchRequest;

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

export type RagWorkerResponse = HashResultMessage | HashBatchResultMessage;
