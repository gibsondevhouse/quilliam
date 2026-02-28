import type {
  PersistedMap,
  PersistedMapPin,
  PersistedMedia,
} from "@/lib/rag/store";

export interface MediaStore {
  putMedia(entry: PersistedMedia): Promise<void>;
  listMediaByUniverse(universeId: string): Promise<PersistedMedia[]>;
  putMap(entry: PersistedMap): Promise<void>;
  listMapsByUniverse(universeId: string): Promise<PersistedMap[]>;
  putMapPin(entry: PersistedMapPin): Promise<void>;
  listMapPinsByMap(mapId: string): Promise<PersistedMapPin[]>;
  listMapPinsByEntry(entryId: string): Promise<PersistedMapPin[]>;
}
