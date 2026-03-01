"use client";

/**
 * Landing page context selector state.
 * Tracks the active context (General vs Library) and persists to localStorage.
 */

import { useCallback, useState } from "react";
import type { GeneralThreadContextType } from "@/lib/rag/store";

const CTX_TYPE_KEY = "quilliam_context_type";
const CTX_LIBRARY_KEY = "quilliam_context_library_id";

export interface LandingContextState {
  contextType: "general" | "library";
  activeLibraryId: string | null;
  setContext: (type: "general" | "library", libraryId?: string) => void;
  activeContextLabel: string;
}

export function useLandingContext(
  libraryNames: Record<string, string> = {},
): LandingContextState {
  const [contextType, setContextType] = useState<"general" | "library">(() => {
    if (typeof window === "undefined") return "general";
    return localStorage.getItem(CTX_TYPE_KEY) === "library" ? "library" : "general";
  });
  const [activeLibraryId, setActiveLibraryId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const savedType = localStorage.getItem(CTX_TYPE_KEY);
    const savedLibId = localStorage.getItem(CTX_LIBRARY_KEY);
    return savedType === "library" && savedLibId ? savedLibId : null;
  });

  const setContext = useCallback(
    (type: "general" | "library", libraryId?: string) => {
      setContextType(type);
      setActiveLibraryId(libraryId ?? null);
      if (typeof window !== "undefined") {
        localStorage.setItem(CTX_TYPE_KEY, type);
        localStorage.setItem(CTX_LIBRARY_KEY, libraryId ?? "");
      }
    },
    [],
  );

  const activeContextLabel =
    contextType === "library" && activeLibraryId
      ? (libraryNames[activeLibraryId] ?? "Library")
      : "General";

  return { contextType, activeLibraryId, setContext, activeContextLabel };
}

// Re-export type alias for hook callers
export type { GeneralThreadContextType };
