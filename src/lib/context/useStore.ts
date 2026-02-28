"use client";

import { useWorkspaceContext } from "./WorkspaceContext";
import type { RAGStore } from "@/lib/rag/store";

/**
 * Returns the initialised RAGStore.
 * Throws if called before the store is ready (will be caught by the nearest
 * Suspense boundary or the component's own loading guard).
 *
 * Components must NOT be rendered until storeReady is true.
 * The library layout gate (StoreGate) ensures this — all library-scoped pages
 * are deferred until the store is available.
 */
export function useStore(): RAGStore {
  const { store } = useWorkspaceContext();
  if (!store) {
    throw new Error(
      "useStore() called before store is ready. " +
        "Ensure the component is rendered inside a StoreGate.",
    );
  }
  return store;
}
