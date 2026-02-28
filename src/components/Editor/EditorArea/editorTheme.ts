import type { Monaco } from "@monaco-editor/react";

export function defineQuilliamTheme(monaco: Monaco): void {
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
}
