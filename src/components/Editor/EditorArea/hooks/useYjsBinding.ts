/**
 * Binds a Y.Text document to a mounted Monaco editor instance.
 *
 * When `chapterId` is provided:
 * 1. Retrieves (or creates) the Y.Doc for that chapter via the singleton registry.
 * 2. Waits for IndexeddbPersistence to sync; seeds Y.Text from `initialContent`
 *    if the document is brand new (empty).
 * 3. Creates a MonacoBinding that keeps Y.Text ↔ Monaco model in sync.
 * 4. Fires `onContentChange` on every Y.Text mutation so the rest of the
 *    pipeline (save, word count, AI patches) continues to work unchanged.
 *
 * When `chapterId` is undefined the hook is a no-op and returns
 * `{ synced: true, setExternalContent: undefined }` so callers can fall back
 * to the legacy string-based setValue approach.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { editor as MonacoEditor } from "monaco-editor";
import { getYjsDoc, YJS_TEXT_KEY } from "@/lib/yjs/yjsDoc";

interface UseYjsBindingOptions {
  chapterId: string | undefined;
  editorRef: MutableRefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  editorReady: boolean;
  initialContent: string;
  onContentChange?: (content: string) => void;
}

interface UseYjsBindingReturn {
  /** True once IndexedDB has been read and the Y.Text is authoritative. */
  synced: boolean;
  /**
   * Replaces the entire document content via a single Yjs transaction.
   * Use this instead of editor.setValue() when Yjs is active so that
   * external updates (AI patches) go through the CRDT layer.
   * Undefined when Yjs is not active (chapterId not provided).
   */
  setExternalContent: ((content: string) => void) | undefined;
}

export function useYjsBinding({
  chapterId,
  editorRef,
  editorReady,
  initialContent,
  onContentChange,
}: UseYjsBindingOptions): UseYjsBindingReturn {
  const [synced, setSynced] = useState(!chapterId);
  // Keep a stable ref to the latest onContentChange to avoid stale captures.
  const onContentChangeRef = useRef(onContentChange);
  useEffect(() => { onContentChangeRef.current = onContentChange; }, [onContentChange]);

  // Cleanup ref so we can destroy the binding on unmount / id change.
  const destroyRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!chapterId || !editorReady) return;
    const editor = editorRef.current;
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const { doc, provider } = getYjsDoc(chapterId);
    const yText = doc.getText(YJS_TEXT_KEY);

    // Dynamic import to avoid pulling y-monaco into the server bundle.
    let cancelled = false;
    void import("y-monaco").then(({ MonacoBinding }) => {
      if (cancelled) return;

      // Wait for IndexedDB to load the persisted state before deciding
      // whether to seed the Y.Text with the initial content.
      void provider.whenSynced.then(() => {
        if (cancelled) return;
        if (yText.length === 0 && initialContent) {
          doc.transact(() => {
            yText.insert(0, initialContent);
          });
        }
        setSynced(true);
      });

      // Create the CRDT ↔ Monaco binding.
      const binding = new MonacoBinding(yText, model, new Set([editor]));

      // Mirror Y.Text mutations to the existing onContentChange pipeline.
      const observer = () => {
        onContentChangeRef.current?.(yText.toString());
      };
      yText.observe(observer);

      destroyRef.current = () => {
        yText.unobserve(observer);
        binding.destroy();
      };
    });

    return () => {
      cancelled = true;
      destroyRef.current?.();
      destroyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, editorReady]);

  const setExternalContent = useCallback(
    (content: string) => {
      if (!chapterId) return;
      const { doc } = getYjsDoc(chapterId);
      const yText = doc.getText(YJS_TEXT_KEY);
      doc.transact(() => {
        yText.delete(0, yText.length);
        yText.insert(0, content);
      });
    },
    [chapterId],
  );

  return {
    synced,
    setExternalContent: chapterId ? setExternalContent : undefined,
  };
}
