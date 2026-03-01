/**
 * Singleton registry for Y.Doc instances keyed by chapter/node ID.
 *
 * Each Y.Doc is backed by an IndexeddbPersistence scoped to the document
 * (stored in `quilliam-yjs-<id>` — separate from the main `quilliam-rag` DB).
 *
 * Calling getYjsDoc() multiple times with the same id always returns the
 * same doc/provider pair, so the Y.Text stays consistent within a tab.
 * Call destroyYjsDoc() when the document is permanently deleted to clean up
 * the IDB store and free memory.
 */

import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";

export const YJS_TEXT_KEY = "content";

export interface YjsDocEntry {
  doc: Y.Doc;
  provider: IndexeddbPersistence;
}

const registry = new Map<string, YjsDocEntry>();

export function getYjsDoc(docId: string): YjsDocEntry {
  const existing = registry.get(docId);
  if (existing) return existing;

  const doc = new Y.Doc();
  const provider = new IndexeddbPersistence(`quilliam-yjs-${docId}`, doc);
  const entry: YjsDocEntry = { doc, provider };
  registry.set(docId, entry);
  return entry;
}

export function destroyYjsDoc(docId: string): void {
  const entry = registry.get(docId);
  if (!entry) return;
  entry.provider.destroy();
  entry.doc.destroy();
  registry.delete(docId);
}
