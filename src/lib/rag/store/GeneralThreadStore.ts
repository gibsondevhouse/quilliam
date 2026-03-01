import type { PersistedGeneralThread } from "@/lib/rag/store";

export interface GeneralThreadStore {
  putGeneralThread(thread: PersistedGeneralThread): Promise<void>;
  listGeneralThreads(): Promise<PersistedGeneralThread[]>;
  getGeneralThread(id: string): Promise<PersistedGeneralThread | undefined>;
  deleteGeneralThread(id: string): Promise<void>;
}
