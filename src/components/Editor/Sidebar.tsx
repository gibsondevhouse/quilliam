"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { NodeType } from "@/lib/rag/hierarchy";
import { VALID_CHILDREN } from "@/lib/rag/hierarchy";
import type {
  CharacterEntry,
  LocationEntry,
  WorldEntry,
  ChatSession,
} from "@/lib/types";

/* Re-export entity types so existing imports from this module continue to work */
export type { CharacterEntry, LocationEntry, WorldEntry, ChatSession };

/* ================================================================
   Shared types
   ================================================================ */

export interface SidebarNode {
  id: string;
  title: string;
  type: NodeType;
  children: SidebarNode[];
  isExpanded?: boolean;
}

/** Outline heading parsed from document text */
export interface OutlineHeading {
  id: string;
  text: string;
  level: number;
  offset: number;
}

export type SidebarTab = "chats" | "manuscripts" | "characters" | "locations" | "world" | "outline";

const TYPE_LABELS: Record<NodeType, string> = {
  library: "Library",
  book: "Book",
  part: "Part",
  chapter: "Chapter",
  scene: "Scene",
  fragment: "Fragment", // internal sub-fragment, not shown in tree
};

const TYPE_ICONS: Record<NodeType, string> = {
  library: "📚",
  book: "📖",
  part: "◆",
  chapter: "§",
  scene: "¶",
  fragment: "·",
};

const PANEL_TITLES: Record<SidebarTab, string> = {
  manuscripts: "EXPLORER",
  chats: "CHATS",
  characters: "CHARACTERS",
  locations: "LOCATIONS",
  world: "WORLD",
  outline: "OUTLINE",
};

/* ================================================================
   Context Menu
   ================================================================ */

interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  nodeType: NodeType;
}

function ContextMenu({
  menu,
  onAddChild,
  onRename,
  onDelete,
  onClose,
}: {
  menu: ContextMenuState;
  onAddChild: (childType: NodeType) => void;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const validChildren = VALID_CHILDREN[menu.nodeType];

  return (
    <div ref={ref} className="ctx-menu" style={{ top: menu.y, left: menu.x }}>
      {validChildren.map((ct) => (
        <button key={ct} className="ctx-menu-item" onClick={() => onAddChild(ct)}>
          {TYPE_ICONS[ct]} New {TYPE_LABELS[ct]}
        </button>
      ))}
      {validChildren.length > 0 && <div className="ctx-menu-divider" />}
      <button className="ctx-menu-item" onClick={onRename}>Rename</button>
      <button className="ctx-menu-item danger" onClick={onDelete}>Delete</button>
    </div>
  );
}

/* ================================================================
   Drag-and-Drop Tree Node
   ================================================================ */

function TreeNode({
  node,
  depth,
  activeNodeId,
  renamingId,
  renameValue,
  onNodeSelect,
  onContextMenu,
  onToggleExpand,
  onDragStart,
  onDragOver,
  onDrop,
  onRenameValueChange,
  onRenameCommit,
  onRenameCancel,
  onDoubleClick,
  dirtyIds,
}: {
  node: SidebarNode;
  depth: number;
  activeNodeId: string | null;
  renamingId: string | null;
  renameValue: string;
  onNodeSelect: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, nodeId: string, nodeType: NodeType) => void;
  onToggleExpand: (id: string) => void;
  onDragStart: (e: React.DragEvent, nodeId: string) => void;
  onDragOver: (e: React.DragEvent, nodeId: string) => void;
  onDrop: (e: React.DragEvent, nodeId: string) => void;
  onRenameValueChange: (val: string) => void;
  onRenameCommit: () => void;
  onRenameCancel: () => void;
  onDoubleClick: (id: string) => void;
  dirtyIds: Set<string>;
}) {
  const [dragOver, setDragOver] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const hasChildren = node.children.length > 0;
  const isActive = node.id === activeNodeId;
  const isRenaming = node.id === renamingId;
  const expanded = node.isExpanded ?? true;
  const isDirty = dirtyIds.has(node.id);

  useEffect(() => {
    if (isRenaming) {
      renameRef.current?.focus();
      renameRef.current?.select();
    }
  }, [isRenaming]);

  return (
    <div>
      <div
        className={`sidebar-tree-item ${isActive ? "active" : ""} ${dragOver ? "drag-over" : ""}`}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        draggable={!isRenaming}
        onClick={() => onNodeSelect(node.id)}
        onDoubleClick={() => onDoubleClick(node.id)}
        onContextMenu={(e) => {
          e.preventDefault();
          onContextMenu(e, node.id, node.type);
        }}
        onDragStart={(e) => onDragStart(e, node.id)}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
          onDragOver(e, node.id);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          setDragOver(false);
          onDrop(e, node.id);
        }}
      >
        <button
          className={`sidebar-expand-btn ${!hasChildren ? "placeholder" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggleExpand(node.id);
          }}
        >
          {hasChildren && (
            <span className={`sidebar-expand-icon ${expanded ? "expanded" : ""}`}>▸</span>
          )}
        </button>
        <span className="sidebar-type-icon">{TYPE_ICONS[node.type]}</span>
        {isRenaming ? (
          <input
            ref={renameRef}
            className="sidebar-rename-input"
            value={renameValue}
            onChange={(e) => onRenameValueChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRenameCommit();
              if (e.key === "Escape") onRenameCancel();
            }}
            onBlur={onRenameCommit}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <>
            <span className="sidebar-item-label">{node.title}</span>
            {isDirty && <span className="sidebar-dirty-dot" title="Unsaved changes" />}
            <span className="sidebar-type-badge">{TYPE_LABELS[node.type]}</span>
          </>
        )}
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              activeNodeId={activeNodeId}
              renamingId={renamingId}
              renameValue={renameValue}
              onNodeSelect={onNodeSelect}
              onContextMenu={onContextMenu}
              onToggleExpand={onToggleExpand}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onRenameValueChange={onRenameValueChange}
              onRenameCommit={onRenameCommit}
              onRenameCancel={onRenameCancel}
              onDoubleClick={onDoubleClick}
              dirtyIds={dirtyIds}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ================================================================
   Panel: Chats
   ================================================================ */

function ChatsPanel({
  chats, activeChatId, onSelectChat, onNewChat, onDeleteChat,
}: {
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
}) {
  return (
    <>
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={onNewChat}>+ New Chat</button>
      </div>
      <div className="sidebar-list">
        {chats.length === 0 ? (
          <div className="sidebar-empty">
            <p>No conversations yet.</p>
            <p className="sidebar-empty-hint">Start a new chat to begin.</p>
          </div>
        ) : (
          chats.map((chat) => (
            <div key={chat.id} className={`sidebar-list-item ${chat.id === activeChatId ? "active" : ""}`} onClick={() => onSelectChat(chat.id)}>
              <div className="sidebar-list-item-content">
                <span className="sidebar-list-item-title">{chat.title}</span>
                <span className="sidebar-list-item-meta">{chat.preview || "Empty"}</span>
              </div>
              <button className="sidebar-list-item-delete" onClick={(e) => { e.stopPropagation(); onDeleteChat(chat.id); }} title="Delete chat">×</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================
   Panel: Characters
   ================================================================ */

function CharactersPanel({
  characters, activeCharacterId, onSelectCharacter, onAddCharacter, onDeleteCharacter,
}: {
  characters: CharacterEntry[];
  activeCharacterId: string | null;
  onSelectCharacter: (id: string) => void;
  onAddCharacter: () => void;
  onDeleteCharacter: (id: string) => void;
}) {
  return (
    <>
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={onAddCharacter}>+ New Character</button>
      </div>
      <div className="sidebar-list">
        {characters.length === 0 ? (
          <div className="sidebar-empty">
            <p>No characters yet.</p>
            <p className="sidebar-empty-hint">Build your cast of characters.</p>
          </div>
        ) : (
          characters.map((ch) => (
            <div key={ch.id} className={`sidebar-list-item ${ch.id === activeCharacterId ? "active" : ""}`} onClick={() => onSelectCharacter(ch.id)}>
              <div className="sidebar-list-item-content">
                <span className="sidebar-list-item-title">{ch.name || "Unnamed"}</span>
                <span className="sidebar-list-item-meta">{ch.role || "No role"}</span>
              </div>
              <button className="sidebar-list-item-delete" onClick={(e) => { e.stopPropagation(); onDeleteCharacter(ch.id); }} title="Delete character">×</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================
   Panel: Locations
   ================================================================ */

function LocationsPanel({
  locations, activeLocationId, onSelectLocation, onAddLocation, onDeleteLocation,
}: {
  locations: LocationEntry[];
  activeLocationId: string | null;
  onSelectLocation: (id: string) => void;
  onAddLocation: () => void;
  onDeleteLocation: (id: string) => void;
}) {
  return (
    <>
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={onAddLocation}>+ New Location</button>
      </div>
      <div className="sidebar-list">
        {locations.length === 0 ? (
          <div className="sidebar-empty">
            <p>No locations yet.</p>
            <p className="sidebar-empty-hint">Map out your story&apos;s world.</p>
          </div>
        ) : (
          locations.map((loc) => (
            <div key={loc.id} className={`sidebar-list-item ${loc.id === activeLocationId ? "active" : ""}`} onClick={() => onSelectLocation(loc.id)}>
              <div className="sidebar-list-item-content">
                <span className="sidebar-list-item-title">{loc.name || "Unnamed"}</span>
                <span className="sidebar-list-item-meta">{loc.description?.slice(0, 40) || "No description"}</span>
              </div>
              <button className="sidebar-list-item-delete" onClick={(e) => { e.stopPropagation(); onDeleteLocation(loc.id); }} title="Delete location">×</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================
   Panel: World
   ================================================================ */

function WorldPanel({
  entries, activeWorldEntryId, onSelectEntry, onAddEntry, onDeleteEntry,
}: {
  entries: WorldEntry[];
  activeWorldEntryId: string | null;
  onSelectEntry: (id: string) => void;
  onAddEntry: () => void;
  onDeleteEntry: (id: string) => void;
}) {
  return (
    <>
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={onAddEntry}>+ New Entry</button>
      </div>
      <div className="sidebar-list">
        {entries.length === 0 ? (
          <div className="sidebar-empty">
            <p>No world entries yet.</p>
            <p className="sidebar-empty-hint">Lore, rules, history, culture — build it all here.</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className={`sidebar-list-item ${entry.id === activeWorldEntryId ? "active" : ""}`} onClick={() => onSelectEntry(entry.id)}>
              <div className="sidebar-list-item-content">
                <span className="sidebar-list-item-title">{entry.title || "Untitled"}</span>
                <span className="sidebar-list-item-meta">{entry.category || "Uncategorized"}</span>
              </div>
              <button className="sidebar-list-item-delete" onClick={(e) => { e.stopPropagation(); onDeleteEntry(entry.id); }} title="Delete entry">×</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================
   Panel: Outline
   ================================================================ */

function OutlinePanel({
  headings, onJumpTo, documentTitle,
}: {
  headings: OutlineHeading[];
  onJumpTo: (offset: number) => void;
  documentTitle: string | null;
}) {
  return (
    <>
      <div className="sidebar-actions">
        <div className="outline-doc-label">{documentTitle || "No document open"}</div>
      </div>
      <div className="sidebar-list">
        {headings.length === 0 ? (
          <div className="sidebar-empty">
            <p>No structure detected.</p>
            <p className="sidebar-empty-hint">Use # Heading, --- scene breaks, or [SCENE] markers.</p>
          </div>
        ) : (
          headings.map((h) => (
            <button key={h.id} className="outline-item" style={{ paddingLeft: `${12 + h.level * 12}px` }} onClick={() => onJumpTo(h.offset)}>
              <span className="outline-item-marker">{h.level === 1 ? "—" : h.level === 2 ? "#" : "##"}</span>
              <span className="outline-item-text">{h.text}</span>
            </button>
          ))
        )}
      </div>
    </>
  );
}

/* ================================================================
   Panel: Manuscripts
   ================================================================ */

function ManuscriptsPanel({
  tree, activeNodeId, onNodeSelect, onAddChild, onRenameNode, onDeleteNode, onToggleExpand, onMoveNode, dirtyIds,
}: {
  tree: SidebarNode[];
  activeNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onAddChild: (parentId: string | null, childType: NodeType) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onDeleteNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string) => void;
  dirtyIds: Set<string>;
}) {
  const [ctxMenu, setCtxMenu] = useState<ContextMenuState | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const handleContextMenu = useCallback((e: React.MouseEvent, nodeId: string, nodeType: NodeType) => {
    setCtxMenu({ x: e.clientX, y: e.clientY, nodeId, nodeType });
  }, []);
  const closeCtx = useCallback(() => setCtxMenu(null), []);

  const startRename = useCallback((nodeId: string) => {
    const findTitle = (nodes: SidebarNode[]): string => {
      for (const n of nodes) {
        if (n.id === nodeId) return n.title;
        const found = findTitle(n.children);
        if (found) return found;
      }
      return "";
    };
    setRenamingId(nodeId);
    setRenameValue(findTitle(tree));
  }, [tree]);

  const commitRename = useCallback(() => {
    if (renamingId && renameValue.trim()) {
      onRenameNode(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  }, [renamingId, renameValue, onRenameNode]);

  const cancelRename = useCallback(() => setRenamingId(null), []);

  const [draggedId, setDraggedId] = useState<string | null>(null);

  const handleDragStart = useCallback((_e: React.DragEvent, nodeId: string) => {
    setDraggedId(nodeId);
  }, []);

  const handleDragOver = useCallback((_e: React.DragEvent, _nodeId: string) => {}, []);

  const handleDrop = useCallback((_e: React.DragEvent, targetId: string) => {
    if (draggedId && draggedId !== targetId) {
      onMoveNode(draggedId, targetId);
    }
    setDraggedId(null);
  }, [draggedId, onMoveNode]);

  return (
    <>
      <div className="sidebar-actions">
        <button className="sidebar-new-btn" onClick={() => onAddChild(null, "library")}>+ New Library</button>
      </div>
      <nav className="sidebar-tree">
        {tree.length === 0 ? (
          <div className="sidebar-empty">
            <p>No libraries yet.</p>
            <p className="sidebar-empty-hint">Create a library to organize your work.</p>
          </div>
        ) : (
          tree.map((node) => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              activeNodeId={activeNodeId}
              renamingId={renamingId}
              renameValue={renameValue}
              onNodeSelect={onNodeSelect}
              onContextMenu={handleContextMenu}
              onToggleExpand={onToggleExpand}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onRenameValueChange={setRenameValue}
              onRenameCommit={commitRename}
              onRenameCancel={cancelRename}
              onDoubleClick={startRename}
              dirtyIds={dirtyIds}
            />
          ))
        )}
      </nav>
      <div className="sidebar-hint">Right-click to add · Double-click to rename · Drag to reorder</div>

      {ctxMenu && (
        <ContextMenu
          menu={ctxMenu}
          onAddChild={(ct) => { onAddChild(ctxMenu.nodeId, ct); closeCtx(); }}
          onRename={() => { startRename(ctxMenu.nodeId); closeCtx(); }}
          onDelete={() => { onDeleteNode(ctxMenu.nodeId); closeCtx(); }}
          onClose={closeCtx}
        />
      )}
    </>
  );
}

/* ================================================================
   Main Sidebar
   ================================================================ */

interface SidebarProps {
  activePanel: SidebarTab;
  tree: SidebarNode[];
  activeNodeId: string | null;
  onNodeSelect: (id: string) => void;
  onAddChild: (parentId: string | null, childType: NodeType) => void;
  onRenameNode: (id: string, newTitle: string) => void;
  onDeleteNode: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onMoveNode: (dragId: string, targetId: string) => void;
  dirtyIds: Set<string>;
  chats: ChatSession[];
  activeChatId: string | null;
  onSelectChat: (id: string) => void;
  onNewChat: () => void;
  onDeleteChat: (id: string) => void;
  characters: CharacterEntry[];
  activeCharacterId: string | null;
  onSelectCharacter: (id: string) => void;
  onAddCharacter: () => void;
  onDeleteCharacter: (id: string) => void;
  locations: LocationEntry[];
  activeLocationId: string | null;
  onSelectLocation: (id: string) => void;
  onAddLocation: () => void;
  onDeleteLocation: (id: string) => void;
  worldEntries: WorldEntry[];
  activeWorldEntryId: string | null;
  onSelectWorldEntry: (id: string) => void;
  onAddWorldEntry: () => void;
  onDeleteWorldEntry: (id: string) => void;
  outlineHeadings: OutlineHeading[];
  outlineDocumentTitle: string | null;
  onOutlineJumpTo: (offset: number) => void;
}

export function Sidebar({
  activePanel,
  tree, activeNodeId, onNodeSelect, onAddChild, onRenameNode, onDeleteNode, onToggleExpand, onMoveNode, dirtyIds,
  chats, activeChatId, onSelectChat, onNewChat, onDeleteChat,
  characters, activeCharacterId, onSelectCharacter, onAddCharacter, onDeleteCharacter,
  locations, activeLocationId, onSelectLocation, onAddLocation, onDeleteLocation,
  worldEntries, activeWorldEntryId, onSelectWorldEntry, onAddWorldEntry, onDeleteWorldEntry,
  outlineHeadings, outlineDocumentTitle, onOutlineJumpTo,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">{PANEL_TITLES[activePanel]}</span>
      </div>
      <div className="sidebar-panel">
        {activePanel === "chats" && (
          <ChatsPanel chats={chats} activeChatId={activeChatId} onSelectChat={onSelectChat} onNewChat={onNewChat} onDeleteChat={onDeleteChat} />
        )}
        {activePanel === "manuscripts" && (
          <ManuscriptsPanel tree={tree} activeNodeId={activeNodeId} onNodeSelect={onNodeSelect} onAddChild={onAddChild} onRenameNode={onRenameNode} onDeleteNode={onDeleteNode} onToggleExpand={onToggleExpand} onMoveNode={onMoveNode} dirtyIds={dirtyIds} />
        )}
        {activePanel === "characters" && (
          <CharactersPanel characters={characters} activeCharacterId={activeCharacterId} onSelectCharacter={onSelectCharacter} onAddCharacter={onAddCharacter} onDeleteCharacter={onDeleteCharacter} />
        )}
        {activePanel === "locations" && (
          <LocationsPanel locations={locations} activeLocationId={activeLocationId} onSelectLocation={onSelectLocation} onAddLocation={onAddLocation} onDeleteLocation={onDeleteLocation} />
        )}
        {activePanel === "world" && (
          <WorldPanel entries={worldEntries} activeWorldEntryId={activeWorldEntryId} onSelectEntry={onSelectWorldEntry} onAddEntry={onAddWorldEntry} onDeleteEntry={onDeleteWorldEntry} />
        )}
        {activePanel === "outline" && (
          <OutlinePanel headings={outlineHeadings} onJumpTo={onOutlineJumpTo} documentTitle={outlineDocumentTitle} />
        )}
      </div>
    </aside>
  );
}
