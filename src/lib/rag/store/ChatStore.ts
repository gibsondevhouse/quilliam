import type { PersistedChatMessage, PersistedChatSession } from "@/lib/rag/store";

export interface ChatStore {
  putChatSession(session: PersistedChatSession): Promise<void>;
  listChatSessions(): Promise<PersistedChatSession[]>;
  listChatSessionsByLibrary(libraryId: string): Promise<PersistedChatSession[]>;
  deleteChatSession(id: string): Promise<void>;
  putChatMessages(
    sessionId: string,
    messages: { role: "user" | "assistant"; content: string }[],
  ): Promise<void>;
  listChatMessages(sessionId: string): Promise<PersistedChatMessage[]>;
}
