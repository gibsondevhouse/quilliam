"use client";

interface KeyboardCheatSheetProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Navigation",
    shortcuts: [
      { keys: "⌘ P", description: "Quick open — jump to any document" },
      { keys: "⌘ ⇧ P", description: "Command palette" },
      { keys: "⌘ /", description: "Toggle this cheat sheet" },
      { keys: "⌘ B", description: "Toggle sidebar" },
      { keys: "⌘ J", description: "Toggle AI panel" },
      { keys: "⌘ Tab", description: "Cycle open tabs" },
    ],
  },
  {
    title: "Panels",
    shortcuts: [
      { keys: "⌘ 1", description: "Explorer panel" },
      { keys: "⌘ 2", description: "AI Chat panel" },
      { keys: "⌘ 3", description: "Characters panel" },
      { keys: "⌘ 4", description: "Locations panel" },
      { keys: "⌘ 5", description: "World panel" },
      { keys: "⌘ 6", description: "Outline panel" },
    ],
  },
  {
    title: "Editing",
    shortcuts: [
      { keys: "⌘ N", description: "New chapter in active context" },
      { keys: "⌘ ⇧ N", description: "New scene in active chapter" },
      { keys: "⌘ S", description: "Save snapshot of current document" },
      { keys: "⌘ ⇧ S", description: "Save all documents" },
      { keys: "⌘ W", description: "Close current tab" },
    ],
  },
  {
    title: "AI Actions (with selection)",
    shortcuts: [
      { keys: "⌘ ⇧ R", description: "Rewrite selection" },
      { keys: "⌘ ⇧ E", description: "Expand/elaborate selection" },
      { keys: "⌘ ⇧ T", description: "Change tone of selection" },
      { keys: "⌘ ⇧ K", description: "Summarize selection" },
    ],
  },
];

export function KeyboardCheatSheet({ open, onClose }: KeyboardCheatSheetProps) {
  if (!open) return null;

  return (
    <div className="cheat-sheet-overlay" onClick={onClose}>
      <div className="cheat-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="cheat-sheet-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="cheat-sheet-close" onClick={onClose}>×</button>
        </div>
        <div className="cheat-sheet-body">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="cheat-sheet-group">
              <h3 className="cheat-sheet-group-title">{group.title}</h3>
              <div className="cheat-sheet-items">
                {group.shortcuts.map((s) => (
                  <div key={s.keys} className="cheat-sheet-item">
                    <span className="cheat-sheet-desc">{s.description}</span>
                    <kbd className="cheat-sheet-keys">{s.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
