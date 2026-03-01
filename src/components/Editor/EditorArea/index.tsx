"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { ChangeSet } from "@/lib/changeSets";
import { EditorTitleBar } from "./EditorTitleBar";
import { useMonacoDecorations } from "./hooks/useMonacoDecorations";
import { useYjsBinding } from "./hooks/useYjsBinding";
import { defineQuilliamTheme } from "./editorTheme";

export interface EditorAreaProps {
  /**
   * When provided, a Yjs Y.Doc backed by IndexeddbPersistence is created for
   * this ID and authoritative over the Monaco model.
   */
  chapterId?: string;
  initialContent?: string;
  /**
   * Live working content driven externally (e.g. AI-patched text).
   * When this prop changes and differs from the current editor value it is
   * pushed into Monaco without firing `onContentChange`.
   */
  content?: string;
  documentTitle?: string;
  onContentChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
  pendingChangeSets?: ChangeSet[];
  onAcceptHunk?: (changeSetId: string) => void;
  onRejectHunk?: (changeSetId: string) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function EditorArea({
  chapterId,
  initialContent = "",
  content,
  documentTitle = "Untitled",
  onContentChange,
  onTitleChange,
  pendingChangeSets = [],
  onAcceptHunk,
  onRejectHunk,
  onAcceptAll,
  onRejectAll,
}: EditorAreaProps) {
  const [title, setTitle] = useState(documentTitle);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [editorReady, setEditorReady] = useState(false);

  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const suppressChange = useRef(false);
  // When Yjs is active it owns onContentChange; suppress double-fire from Monaco model handler.
  const chapterIdRef = useRef(chapterId);
  useEffect(() => { chapterIdRef.current = chapterId; }, [chapterId]);

  useEffect(() => { setTitle(documentTitle); }, [documentTitle]);

  const refreshCounts = useCallback((value: string) => {
    const trimmed = value.trim();
    setCharCount(value.length);
    setWordCount(trimmed === "" ? 0 : trimmed.split(/\s+/).length);
  }, []);

  const setEditorContent = useCallback((value: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() === value) return;
    suppressChange.current = true;
    editor.setValue(value);
    suppressChange.current = false;
  }, []);

  // ---- Yjs binding ----
  const { synced, setExternalContent } = useYjsBinding({
    chapterId,
    editorRef,
    editorReady,
    initialContent,
    onContentChange,
  });

  useEffect(() => {
    if (chapterId) return; // Yjs path handles seeding
    setEditorContent(initialContent);
    refreshCounts(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  useEffect(() => {
    if (content === undefined) return;
    if (setExternalContent) {
      setExternalContent(content);
      refreshCounts(content);
    } else {
      setEditorContent(content);
      refreshCounts(content);
    }
  }, [content, setEditorContent, setExternalContent, refreshCounts]);

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;
      defineQuilliamTheme(monaco);

      // Only seed through the legacy path when Yjs is not active.
      if (!chapterIdRef.current && initialContent) {
        suppressChange.current = true;
        editor.setValue(initialContent);
        suppressChange.current = false;
        refreshCounts(initialContent);
      }

      editor.onDidChangeModelContent(() => {
        if (suppressChange.current) return;
        const value = editor.getValue();
        refreshCounts(value);
        // When Yjs is active, the Y.Text observer fires onContentChange instead.
        if (!chapterIdRef.current) {
          onContentChange?.(value);
        }
      });

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        window.dispatchEvent(new CustomEvent("quilliam:save"));
      });

      setEditorReady(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally run once on mount
  );

  useMonacoDecorations({ editorRef, monacoRef, pendingChangeSets, onAcceptHunk, onRejectHunk });

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange],
  );

  const pendingCount = pendingChangeSets.filter((cs) => cs.status === "pending").length;
  const showSyncing = chapterId && !synced;

  return (
    <div className="editor-area">
      <EditorTitleBar
        title={title}
        pendingCount={pendingCount}
        onTitleChange={handleTitleChange}
        onAcceptAll={onAcceptAll}
        onRejectAll={onRejectAll}
      />

      <div className="editor-surface editor-surface--monaco" style={{ position: "relative" }}>
        {showSyncing && (
          <div className="editor-yjs-syncing">
            <span className="chat-dot" />
            <span className="chat-dot" />
            <span className="chat-dot" />
            <span className="editor-yjs-syncing-label">Loading document…</span>
          </div>
        )}
        <Editor
          defaultLanguage="markdown"
          theme="quilliam-dark"
          options={{
            fontSize: 16,
            lineHeight: 28,
            fontFamily: "var(--font-sans, 'Georgia', serif)",
            wordWrap: "on",
            wrappingStrategy: "advanced",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderValidationDecorations: "off",
            overviewRulerLanes: 0,
            renderLineHighlight: "line",
            lineNumbers: "off",
            glyphMargin: false,
            folding: false,
            lineDecorationsWidth: 6,
            renderWhitespace: "none",
            smoothScrolling: true,
            cursorBlinking: "smooth",
            padding: { top: 16, bottom: 80 },
          }}
          onMount={handleEditorMount}
          loading={
            <div className="editor-monaco-loading">
              <span className="chat-dot" />
              <span className="chat-dot" />
              <span className="chat-dot" />
            </div>
          }
        />
      </div>

      <div className="editor-stats">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
        {chapterId && (
          <span className="editor-stats-yjs" title="CRDT collaborative editing active">
            ⊕ live
          </span>
        )}
        {pendingCount > 0 && (
          <span className="editor-stats-pending">
            {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
