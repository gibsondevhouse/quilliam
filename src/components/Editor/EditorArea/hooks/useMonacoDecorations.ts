"use client";

import { useEffect, useRef } from "react";
import type { Monaco } from "@monaco-editor/react";
import type { editor as MonacoEditor } from "monaco-editor";
import type { ChangeSet } from "@/lib/changeSets";
import { computeLineStates, LINE_CHANGE_CLASSES } from "@/lib/changeSets";

interface HunkWidget {
  changeSetId: string;
  lineNumber: number;
  domNode: HTMLDivElement;
  widget: MonacoEditor.IContentWidget;
}

interface UseMonacoDecorationsParams {
  editorRef: React.RefObject<MonacoEditor.IStandaloneCodeEditor | null>;
  monacoRef: React.RefObject<Monaco | null>;
  pendingChangeSets: ChangeSet[];
  onAcceptHunk?: (changeSetId: string) => void;
  onRejectHunk?: (changeSetId: string) => void;
}

export function useMonacoDecorations({
  editorRef,
  monacoRef,
  pendingChangeSets,
  onAcceptHunk,
  onRejectHunk,
}: UseMonacoDecorationsParams): void {
  const decorationsRef = useRef<string[]>([]);
  const hunkWidgetsRef = useRef<HunkWidget[]>([]);

  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;

    const content = editor.getValue();
    const lineStates = computeLineStates(content, pendingChangeSets);

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

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations);

    // Remove old hunk widgets
    for (const hw of hunkWidgetsRef.current) {
      editor.removeContentWidget(hw.widget);
      hw.domNode.remove();
    }
    hunkWidgetsRef.current = [];

    if (onAcceptHunk ?? onRejectHunk) {
      const lines = content.split("\n");

      for (const cs of pendingChangeSets) {
        if (cs.status !== "pending" || cs.edits.length === 0) continue;

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
            preference: [1],
          }),
        };

        editor.addContentWidget(widget);
        hunkWidgetsRef.current.push({ changeSetId: csId, lineNumber: firstLine, domNode: dom, widget });
      }
    }
  }, [editorRef, monacoRef, pendingChangeSets, onAcceptHunk, onRejectHunk]);

  // Cleanup on unmount
  useEffect(() => () => {
    const editor = editorRef.current;
    if (!editor) return;
    for (const hw of hunkWidgetsRef.current) {
      editor.removeContentWidget(hw.widget);
      hw.domNode.remove();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
