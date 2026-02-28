import type {
  PersistedMap,
  PersistedMapPin,
  PersistedMedia,
} from "@/lib/rag/store";
import type { MediaStore } from "@/lib/rag/store/MediaStore";
import type { QuillDB } from "./schema";

export function createMediaStore(db: QuillDB): MediaStore {
  return {
    async putMedia(entry: PersistedMedia): Promise<void> {
      await db.put("media", entry);
    },
    async listMediaByUniverse(universeId: string): Promise<PersistedMedia[]> {
      return db.getAllFromIndex("media", "by_universe", universeId);
    },

    async putMap(entry: PersistedMap): Promise<void> {
      await db.put("maps", entry);
    },
    async listMapsByUniverse(universeId: string): Promise<PersistedMap[]> {
      return db.getAllFromIndex("maps", "by_universe", universeId);
    },

    async putMapPin(entry: PersistedMapPin): Promise<void> {
      await db.put("mapPins", entry);
    },
    async listMapPinsByMap(mapId: string): Promise<PersistedMapPin[]> {
      return db.getAllFromIndex("mapPins", "by_map", mapId);
    },
    async listMapPinsByEntry(entryId: string): Promise<PersistedMapPin[]> {
      return db.getAllFromIndex("mapPins", "by_entry", entryId);
    },
  };
}
