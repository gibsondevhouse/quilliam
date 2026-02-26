"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface EditorAreaProps {
  initialContent?: string;
  documentTitle?: string;
  onContentChange?: (content: string) => void;
  onTitleChange?: (title: string) => void;
}

export function EditorArea({
  initialContent = "",
  documentTitle = "Untitled",
  onContentChange,
  onTitleChange,
}: EditorAreaProps) {
  const [title, setTitle] = useState(documentTitle);
  const [content, setContent] = useState(initialContent);
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Update word/char counts
  useEffect(() => {
    const trimmed = content.trim();
    setCharCount(content.length);
    setWordCount(trimmed === "" ? 0 : trimmed.split(/\s+/).length);
  }, [content]);

  // Sync external updates
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  useEffect(() => {
    setTitle(documentTitle);
  }, [documentTitle]);

  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newContent = e.target.value;
      setContent(newContent);
      onContentChange?.(newContent);
    },
    [onContentChange]
  );

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      onTitleChange?.(newTitle);
    },
    [onTitleChange]
  );

  // Auto-focus the editor
  useEffect(() => {
    editorRef.current?.focus();
  }, []);

  // Handle Tab key for indentation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newContent =
          content.substring(0, start) + "  " + content.substring(end);
        setContent(newContent);
        onContentChange?.(newContent);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [content, onContentChange]
  );

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

      {/* Writing surface */}
      <div className="editor-surface">
        <textarea
          ref={editorRef}
          value={content}
          onChange={handleContentChange}
          onKeyDown={handleKeyDown}
          className="editor-textarea"
          placeholder="Start writing..."
          spellCheck={true}
        />
      </div>

      {/* Bottom stats bar */}
      <div className="editor-stats">
        <span>{wordCount} words</span>
        <span>{charCount} characters</span>
      </div>
    </div>
  );
}
