import type { PersistedGeneralThread } from "@/lib/rag/store";
import type { GeneralThreadStore } from "@/lib/rag/store/GeneralThreadStore";
import type { QuillDB } from "./schema";

export function createGeneralThreadStore(db: QuillDB): GeneralThreadStore {
  return {
    async putGeneralThread(thread: PersistedGeneralThread): Promise<void> {
      await db.put("generalThreads", thread);
    },

    async listGeneralThreads(): Promise<PersistedGeneralThread[]> {
      const all = await db.getAllFromIndex("generalThreads", "by_updated");
      return all.reverse(); // most-recently updated first
    },

    async getGeneralThread(id: string): Promise<PersistedGeneralThread | undefined> {
      return db.get("generalThreads", id);
    },

    async deleteGeneralThread(id: string): Promise<void> {
      const tx = db.transaction(["generalThreads", "chatMessages"], "readwrite");
      await tx.objectStore("generalThreads").delete(id);
      const index = tx.objectStore("chatMessages").index("by_session");
      let cursor = await index.openCursor(id);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    },
  };
}
