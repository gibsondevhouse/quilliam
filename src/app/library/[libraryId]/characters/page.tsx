"use client";

import { useLibraryContext } from "@/lib/context/LibraryContext";
import { CharacterEditor } from "@/components/Editor/CharacterEditor";

export default function CharactersPage() {
  const lib = useLibraryContext();

  const active = lib.characters.find((c) => c.id === lib.activeCharacterId);

  return (
    <div className="library-page characters-page split-page">
      {/* Left: list */}
      <div className="split-page-list">
        <div className="library-page-header">
          <h2>Characters</h2>
          <button className="library-page-action" onClick={() => lib.addCharacter()}>+ Add</button>
        </div>
        {lib.characters.length === 0 ? (
          <div className="library-page-empty">
            <p>No characters yet.</p>
            <button className="library-page-action primary" onClick={() => lib.addCharacter()}>
              Add your first character
            </button>
          </div>
        ) : (
          <ul className="library-item-list">
            {lib.characters.map((c) => (
              <li key={c.id} className="library-item-row">
                <button
                  className={`library-item-btn ${lib.activeCharacterId === c.id ? "active" : ""}`}
                  onClick={() => lib.selectCharacter(c.id)}
                >
                  <span className="library-item-avatar">{(c.name || "?")[0].toUpperCase()}</span>
                  <div className="library-item-info">
                    <span className="library-item-title">{c.name || "Unnamed"}</span>
                    {c.role && <span className="library-item-preview">{c.role}</span>}
                  </div>
                </button>
                <button
                  className="library-item-delete"
                  onClick={(e) => { e.stopPropagation(); lib.deleteCharacter(c.id); }}
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Right: editor */}
      <div className="split-page-editor">
        {active ? (
          <CharacterEditor
            key={active.id}
            character={active}
            onChange={lib.updateCharacter}
          />
        ) : (
          <div className="library-page-empty">
            <p>Select a character to edit, or add a new one.</p>
          </div>
        )}
      </div>
    </div>
  );
}
