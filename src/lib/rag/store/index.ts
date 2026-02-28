/**
 * Composed RAGStore interface — intersection of all domain sub-store interfaces.
 *
 * `RAGStore` is defined in the parent `@/lib/rag/store` module and re-exported
 * here so consumers can also import from `@/lib/rag/store/` (the directory).
 * Sub-store interfaces are exported individually for typed domain access.
 */

import type { ChatStore } from "./ChatStore";
import type { EntryStore } from "./EntryStore";
import type { ManuscriptStore } from "./ManuscriptStore";
import type { MediaStore } from "./MediaStore";
import type { NodeStore } from "./NodeStore";
import type { PatchStore } from "./PatchStore";
import type { RelationStore } from "./RelationStore";
import type { ResearchStore } from "./ResearchStore";
import type { TimelineStore } from "./TimelineStore";

export type {
  ChatStore,
  EntryStore,
  ManuscriptStore,
  MediaStore,
  NodeStore,
  PatchStore,
  RelationStore,
  ResearchStore,
  TimelineStore,
};

export type { RAGStore } from "../store";
