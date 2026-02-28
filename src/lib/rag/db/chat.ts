import type {
  PersistedChatMessage,
  PersistedChatSession,
} from "@/lib/rag/store";
import type { ChatStore } from "@/lib/rag/store/ChatStore";
import type { QuillDB } from "./schema";

export function createChatStore(db: QuillDB): ChatStore {
  return {
    async putChatSession(session: PersistedChatSession): Promise<void> {
      await db.put("chatSessions", session);
    },

    async listChatSessions(): Promise<PersistedChatSession[]> {
      const all = await db.getAllFromIndex("chatSessions", "by_updated");
      return all.reverse(); // most-recently updated first
    },

    async listChatSessionsByLibrary(libraryId: string): Promise<PersistedChatSession[]> {
      const all = await db.getAllFromIndex("chatSessions", "by_library", libraryId);
      return all.sort((a, b) => b.updatedAt - a.updatedAt);
    },

    async deleteChatSession(id: string): Promise<void> {
      const tx = db.transaction(["chatSessions", "chatMessages"], "readwrite");
      await tx.objectStore("chatSessions").delete(id);
      const index = tx.objectStore("chatMessages").index("by_session");
      let cursor = await index.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    },

    async putChatMessages(
      sessionId: string,
      messages: { role: "user" | "assistant"; content: string }[],
    ): Promise<void> {
      const tx = db.transaction("chatMessages", "readwrite");
      // clear existing messages for this session
      const index = tx.store.index("by_session");
      let cursor = await index.openCursor(sessionId);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      // write fresh
      for (let i = 0; i < messages.length; i++) {
        const msg: PersistedChatMessage = {
          key: `${sessionId}::${i}`,
          sessionId,
          index: i,
          role: messages[i].role,
          content: messages[i].content,
          createdAt: Date.now(),
        };
        await tx.store.put(msg);
      }
      await tx.done;
    },

    async listChatMessages(sessionId: string): Promise<PersistedChatMessage[]> {
      const all = await db.getAllFromIndex("chatMessages", "by_session", sessionId);
      return all.sort((a, b) => a.index - b.index);
    },
  };
}
