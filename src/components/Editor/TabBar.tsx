"use client";

export interface EditorTab {
  id: string;
  kind: "chapter" | "character" | "location" | "world";
  title: string;
}

interface TabBarProps {
  tabs: EditorTab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
}

const KIND_ICONS: Record<EditorTab["kind"], string> = {
  chapter: "§",
  character: "⊕",
  location: "◎",
  world: "◈",
};

export function TabBar({ tabs, activeTabId, onSelectTab, onCloseTab }: TabBarProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      <div className="tab-bar-scroll">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => onSelectTab(tab.id)}
          >
            <span className="tab-kind-icon">{KIND_ICONS[tab.kind]}</span>
            <span className="tab-title">{tab.title || "Untitled"}</span>
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
