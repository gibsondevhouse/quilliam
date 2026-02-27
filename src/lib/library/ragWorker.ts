import {
  type Dispatch,
  type RefObject,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { RAGNode } from "@/lib/rag/hierarchy";
import { createRAGNode } from "@/lib/rag/hierarchy";
import type { RagWorkerRequest, RagWorkerResponse } from "@/lib/rag/messages";
import { chunkScene, needsChunking, staleFragmentIds } from "@/lib/rag/chunker";
import { embedNode } from "@/lib/rag/embedder";
import type { RAGStore } from "@/lib/rag/store";
import type { StartupStatus } from "@/components/SystemStatus";

interface UseRagWorkerParams {
  storeReady: boolean;
  ragNodes: Record<string, RAGNode>;
  putRagNode: (node: RAGNode) => void;
  storeRef: RefObject<RAGStore | null>;
  systemStatus: StartupStatus;
  docContentsRef: RefObject<Record<string, { title: string; content: string }>>;
  setSavedContents: Dispatch<SetStateAction<Record<string, string>>>;
}

export function useRagWorker(params: UseRagWorkerParams) {
  const {
    storeReady,
    ragNodes,
    putRagNode,
    storeRef,
    systemStatus,
    docContentsRef,
    setSavedContents,
  } = params;

  const [indexingCount, setIndexingCount] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const ragNodesRef = useRef(ragNodes);
  const systemStatusRef = useRef(systemStatus);

  useEffect(() => {
    ragNodesRef.current = ragNodes;
  }, [ragNodes]);

  useEffect(() => {
    systemStatusRef.current = systemStatus;
  }, [systemStatus]);

  useEffect(() => {
    let cancelled = false;
    if (!storeReady) return;

    const worker = new Worker(new URL("../../workers/rag-indexer.ts", import.meta.url));
    workerRef.current = worker;

    worker.onmessage = async (event: MessageEvent<RagWorkerResponse>) => {
      if (cancelled) return;
      const data = event.data;

      if (data.type !== "hash-result") return;
      const { fragmentId, contentHash, tokenCount } = data.result;
      const doc = docContentsRef.current[fragmentId];
      setIndexingCount((count) => Math.max(0, count - 1));
      if (!doc) return;

      const existingNode = ragNodesRef.current[fragmentId];
      const updated: RAGNode = {
        ...(existingNode ??
          createRAGNode(fragmentId, "chapter", doc.title, doc.content, null, contentHash)),
        title: doc.title,
        content: doc.content,
        contentHash,
        tokenCount,
        updatedAt: Date.now(),
      };

      putRagNode(updated);
      setSavedContents((prev) => ({ ...prev, [fragmentId]: doc.content }));

      const prevChunkTotal = existingNode?.chunkTotal ?? 0;
      const shouldChunk = needsChunking(doc.content);
      let chunks: RAGNode[] = [];
      if (shouldChunk) {
        const embedFnModel = systemStatusRef.current?.embedModel ?? "nomic-embed-text";
        const embedFn = async (text: string): Promise<Float32Array> => {
          const res = await fetch("/api/embeddings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ input: text, model: embedFnModel }),
          });
          if (!res.ok) throw new Error(`Embeddings fetch failed: ${res.status}`);
          const json = (await res.json()) as { embedding: number[] };
          return new Float32Array(json.embedding);
        };
        chunks = await chunkScene(fragmentId, doc.title, doc.content, embedFn);
        putRagNode({
          ...updated,
          chunkTotal: chunks.length,
          childrenIds: chunks.map((chunk) => chunk.id),
        });
      }

      if (prevChunkTotal > 0) {
        const staleIds = staleFragmentIds(fragmentId, prevChunkTotal);
        for (const id of staleIds) void storeRef.current?.deleteNode(id);
      }

      const embedModel = systemStatusRef.current?.embedModel ?? "nomic-embed-text";
      if (shouldChunk && chunks.length > 0 && storeRef.current) {
        for (const chunk of chunks) {
          putRagNode(chunk);
          void embedNode(
            chunk.id,
            chunk.content,
            chunk.contentHash,
            embedModel,
            storeRef.current,
          ).then((result) => {
            if (!result.ok && result.reason !== "empty_content") {
              console.error("Chunk embedding failed", {
                fragmentId: chunk.id,
                reason: result.reason,
                cacheLookup: result.cacheLookup,
                error: result.error,
              });
            }
          });
        }
      } else if (!shouldChunk && storeRef.current) {
        void embedNode(
          fragmentId,
          doc.content,
          contentHash,
          embedModel,
          storeRef.current,
        ).then((result) => {
          if (!result.ok && result.reason !== "empty_content") {
            console.error("Fragment embedding failed", {
              fragmentId,
              reason: result.reason,
              cacheLookup: result.cacheLookup,
              error: result.error,
            });
          }
        });
      }
    };

    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
  }, [docContentsRef, putRagNode, setSavedContents, storeReady, storeRef]);

  const queueHash = useCallback((chapterId: string, content: string) => {
    const worker = workerRef.current;
    if (!worker) return;
    setIndexingCount((count) => count + 1);
    const request: RagWorkerRequest = {
      type: "hash",
      fragment: { fragmentId: chapterId, content },
    };
    worker.postMessage(request);
  }, []);

  return {
    workerRef,
    ragNodesRef,
    indexingCount,
    queueHash,
  };
}
