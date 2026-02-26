"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Editor, { type Monaco, type OnMount } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { ChangeSet } from "@/lib/changeSets";
import { computeLineStates, LINE_CHANGE_CLASSES } from "@/lib/changeSets";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface EditorAreaProps {
  initialContent?: string;
  /**
   * Live working content driven externally (e.g. AI-patched text).
   * When this prop changes and differs from the current editor value it is
   * pushed into Monaco without firing `onContentChange`, so the editor
   * always reflects the AI's proposed state.
   */
  content?: string;
  documentTitle?: string;
  onContentChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
  /** Pending AI change sets to visualise as inline decorations. */
  pendingChangeSets?: ChangeSet[];
  /** Called when the user accepts a single hunk (changeSetId). */
  onAcceptHunk?: (changeSetId: string) => void;
  /** Called when the user rejects a single hunk (changeSetId). */
  onRejectHunk?: (changeSetId: string) => void;
}

// ---------------------------------------------------------------------------
// Hunk widget state (managed imperatively via Monaco API)
// ---------------------------------------------------------------------------

interface HunkWidget {
  changeSetId: string;
  lineNumber: number;
  domNode: HTMLDivElement;
  widget: MonacoEditor.IContentWidget;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EditorArea({
  initialContent = "",
  content,
  documentTitle = "Untitled",
  onContentChange,
  onTitleChange,
  pendingChangeSets = [],
  onAcceptHunk,
  onRejectHunk,
}: EditorAreaProps) {
  const [title, setTitle] = useState(documentTitle);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);

  // Monaco refs — kept outside state so they never cause extra renders
  const monacoRef = useRef<Monaco | null>(null);
  const editorRef = useRef<MonacoEditor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const hunkWidgetsRef = useRef<HunkWidget[]>([]);
  const suppressChange = useRef(false);

  // Sync title from parent
  useEffect(() => { setTitle(documentTitle); }, [documentTitle]);

  const refreshCounts = useCallback((content: string) => {
    const trimmed = content.trim();
    setCharCount(content.length);
    setWordCount(trimmed === "" ? 0 : trimmed.split(/\s+/).length);
  }, []);

  // Push new content into Monaco without triggering onContentChange
  const setEditorContent = useCallback((value: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    if (editor.getValue() === value) return;
    suppressChange.current = true;
    editor.setValue(value);
    suppressChange.current = false;
  }, []);

  // When initialContent prop changes (e.g. switching documents), push into Monaco
  useEffect(() => {
    setEditorContent(initialContent);
    refreshCounts(initialContent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialContent]);

  // When AI-patched working content arrives, push it into Monaco without
  // triggering onContentChange (so the base docContents stays clean until
  // the user accepts the change).
  useEffect(() => {
    if (content === undefined) return;
    setEditorContent(content);
    refreshCounts(content);
  }, [content, setEditorContent, refreshCounts]);

  // ---------------------------------------------------------------------------
  // Monaco mount — called once
  // ---------------------------------------------------------------------------

  const handleEditorMount: OnMount = useCallback(
    (editor, monaco) => {
      editorRef.current = editor;
      monacoRef.current = monaco;

      // Quilliam dark theme
      monaco.editor.defineTheme("quilliam-dark", {
        base: "vs-dark",
        inherit: true,
        rules: [],
        colors: {
          "editor.background": "#0f0f0f",
          "editor.foreground": "#d4d4d4",
          "editorCursor.foreground": "#7c6af7",
          "editor.lineHighlightBackground": "#181818",
          "editorLineNumber.foreground": "#3a3a3a",
          "editorLineNumber.activeForeground": "#7c6af7",
        },
      });
      monaco.editor.setTheme("quilliam-dark");

      // Seed with initial content
      if (initialContent) {
        suppressChange.current = true;
        editor.setValue(initialContent);
        suppressChange.current = false;
        refreshCounts(initialContent);
      }

      // User edits
      editor.onDidChangeModelContent(() => {
        if (suppressChange.current) return;
        const value = editor.getValue();
        refreshCounts(value);
        onContentChange?.(value);
      });

      // Cmd/Ctrl+S → dispatch save event so parent can persist
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        window.dispatchEvent(new CustomEvent("quilliam:save"));
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [] // intentionally run once on mount
  );

  // ---------------------------------------------------------------------------
  // Decorations — recompute whenever pendingChangeSets changes
  // ---------------------------------------------------------------------------

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const content = editor.getValue();
    const lineStates = computeLineStates(content, pendingChangeSets);

    // Build decoration array
    const newDecorations: MonacoEditor.IModelDeltaDecoration[] = [];
    lineStates.forEach((state, i) => {
      if (state === "unchanged") return;
      const cssClass = LINE_CHANGE_CLASSES[state];
      if (!cssClass) return;
      newDecorations.push({
        range: new monaco.Range(i + 1, 1, i + 1, 1),
        options: {
          isWholeLine: true,
          className: cssClass,
          linesDecorationsClassName: `${cssClass}-bar`,
        },
      });
    });

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations
    );

    // ---- Hunk accept/reject widgets ----
    for (const hw of hunkWidgetsRef.current) {
      editor.removeContentWidget(hw.widget);
      hw.domNode.remove();
    }
    hunkWidgetsRef.current = [];

    if ((onAcceptHunk || onRejectHunk)) {
      const lines = content.split("\n");

      for (const cs of pendingChangeSets) {
        if (cs.status !== "pending" || cs.edits.length === 0) continue;

        // First affected line (1-based)
        let firstLine = 1;
        const edit = cs.edits[0];
        if (edit.type === "replace" || edit.type === "delete") {
          firstLine = Math.min(edit.start + 1, lines.length);
        } else if (edit.type === "insert") {
          firstLine = Math.min(edit.afterIndex + 2, lines.length);
        }

        const dom = document.createElement("div");
        dom.className = "ql-hunk-overlay";

        if (onAcceptHunk) {
          const btn = document.createElement("button");
          btn.className = "ql-hunk-btn ql-hunk-accept";
          btn.textContent = "✓";
          btn.title = "Accept this change";
          btn.onclick = (e) => { e.stopPropagation(); onAcceptHunk(cs.id); };
          dom.appendChild(btn);
        }

        if (onRejectHunk) {
          const btn = document.createElement("button");
          btn.className = "ql-hunk-btn ql-hunk-reject";
          btn.textContent = "✗";
          btn.title = "Reject this change";
          btn.onclick = (e) => { e.stopPropagation(); onRejectHunk(cs.id); };
          dom.appendChild(btn);
        }

        const csId = cs.id;
        const widget: MonacoEditor.IContentWidget = {
          getId: () => `hunk-${csId}`,
          getDomNode: () => dom,
          getPosition: () => ({
            position: { lineNumber: firstLine, column: Number.MAX_SAFE_INTEGER },
            preference: [1], // EXACT
          }),
        };

        editor.addContentWidget(widget);
        hunkWidgetsRef.current.push({ changeSetId: csId, lineNumber: firstLine, domNode: dom, widget });
      }
    }
  }, [pendingChangeSets, onAcceptHunk, onRejectHunk]);

  // Clean up widgets when component unmounts
  useEffect(() => () => {
    const editor = editorRef.current;
    if (!editor) return;
    for (const hw of hunkWidgetsRef.current) {
      editor.removeContentWidget(hw.widget);
      hw.domNode.remove();
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Title
  // ---------------------------------------------------------------------------

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const pendingCount = pendingChangeSets.filter((cs) => cs.status === "pending").length;

  return (
    <div className="editor-area">
      {/* Title bar */}
      <div className="editor-title-bar">
        <input
          type="text"
          value={title}
          onChange={handleTitleChange}
          className="editor-title-input"
          placeholder="Untitled"
          spellCheck={false}
        />
      </div>

      {/* Monaco writing surface */}
      <div className="editor-surface editor-surface--monaco">
        <Editor
          defaultLanguage="markdown"
          theme="quilliam-dark"
          options={{
            fontSize: 16,
            lineHeight: 28,
            fontFamily: "var(--font-sans, 'Georgia', serif)",
            wordWrap: "on",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            overviewRulerLanes: 0,
            renderLineHighlight: "line",
            lineNumbers: "on",
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

      {/* Bottom stats bar */}
      <div className="editor-stats">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
        {pendingCount > 0 && (
          <span className="editor-stats-pending">
            {pendingCount} pending change{pendingCount !== 1 ? "s" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
