"use client";

interface EditorTitleBarProps {
  title: string;
  pendingCount: number;
  onTitleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onAcceptAll?: () => void;
  onRejectAll?: () => void;
}

export function EditorTitleBar({
  title,
  pendingCount,
  onTitleChange,
  onAcceptAll,
  onRejectAll,
}: EditorTitleBarProps) {
  return (
    <div className="editor-title-bar">
      <input
        type="text"
        value={title}
        onChange={onTitleChange}
        className="editor-title-input"
        placeholder="Untitled"
        spellCheck={false}
      />
      {pendingCount > 0 && (
        <div className="editor-title-actions">
          {onAcceptAll && (
            <button type="button" className="editor-title-btn accept" onClick={onAcceptAll}>
              Accept All
            </button>
          )}
          {onRejectAll && (
            <button type="button" className="editor-title-btn reject" onClick={onRejectAll}>
              Reject All
            </button>
          )}
        </div>
      )}
    </div>
  );
}
