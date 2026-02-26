/**
 * Shared entity types for Quilliam.
 * All user-created entities are scoped to a Library via libraryId.
 */

export interface CharacterEntry {
  id: string;
  libraryId: string;
  name: string;
  role: string;
  notes: string;
}

export interface LocationEntry {
  id: string;
  libraryId: string;
  name: string;
  description: string;
}

export interface WorldEntry {
  id: string;
  libraryId: string;
  title: string;
  category: string;
  notes: string;
}

export interface ChatSession {
  id: string;
  /** libraryId is required for new sessions; legacy sessions may have it undefined */
  libraryId: string;
  title: string;
  createdAt: number;
  preview: string;
}

export interface ChatMessageEntry {
  role: "user" | "assistant";
  content: string;
}

/** Story (Book/Novel/Project) — belongs to one Library, contains Chapters */
export interface Story {
  id: string;
  libraryId: string;
  title: string;
  synopsis: string;
  genre: string;
  status: "drafting" | "editing" | "archived";
  createdAt: number;
}

/** Library-level metadata stored alongside the RAGNode of type "library" */
export interface LibraryMeta {
  description?: string;
  logline?: string;
  status?: "drafting" | "editing" | "archived";
}
