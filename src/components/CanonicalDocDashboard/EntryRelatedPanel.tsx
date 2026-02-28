"use client";

import { useState } from "react";
import type { CultureMembershipKind } from "@/lib/types";
import type { RelatedPanelProps } from "./types";

const MEMBERSHIP_KINDS: CultureMembershipKind[] = [
  "primary", "secondary", "diaspora", "adopted", "assimilated", "ancestral",
];

export function EntryRelatedPanel({
  entryType,
  appearances,
  members,
  linkedCultures,
  onAddMember,
  onRemoveMember,
}: RelatedPanelProps) {
  const [addCharId, setAddCharId] = useState("");
  const [addKind, setAddKind] = useState<CultureMembershipKind>("primary");

  if (entryType === "culture") {
    return (
      <section className="entry-related-panel">
        <h3 className="entry-related-heading">Culture Roster</h3>
        {members.length === 0 ? (
          <p className="entry-related-empty">No characters assigned yet.</p>
        ) : (
          <ul className="entry-related-list">
            {members.map(({ membership, characterName }) => (
              <li key={membership.id} className="entry-related-row">
                <span className="entry-related-name">{characterName || membership.characterEntryId}</span>
                <span className="entry-related-badge">{membership.membershipKind}</span>
                <button
                  className="entry-related-remove"
                  title="Remove membership"
                  onClick={() => onRemoveMember(membership.id)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="entry-related-add-form">
          <input
            className="canonical-doc-input"
            placeholder="Character entry ID"
            value={addCharId}
            onChange={(e) => setAddCharId(e.target.value)}
          />
          <select
            className="canonical-doc-input"
            value={addKind}
            onChange={(e) => setAddKind(e.target.value as CultureMembershipKind)}
          >
            {MEMBERSHIP_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <button
            className="library-page-action"
            disabled={!addCharId.trim()}
            onClick={() => {
              onAddMember(addCharId.trim(), addKind);
              setAddCharId("");
            }}
          >
            + Assign
          </button>
        </div>
      </section>
    );
  }

  if (entryType === "character") {
    return (
      <section className="entry-related-panel">
        <h3 className="entry-related-heading">Appears In</h3>
        {appearances.length === 0 ? (
          <p className="entry-related-empty">No scene mentions found. Mentions are created when scenes reference this character.</p>
        ) : (
          <ul className="entry-related-list">
            {appearances.map((row) => (
              <li key={row.sceneId} className="entry-related-row">
                <span className="entry-related-name">{row.sceneTitle || row.sceneId}</span>
                <span className="entry-related-badge">{row.mentionType}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  if (entryType === "location") {
    return (
      <section className="entry-related-panel">
        <h3 className="entry-related-heading">Linked Cultures (Homeland)</h3>
        {linkedCultures.length === 0 ? (
          <p className="entry-related-empty">No cultures list this as their homeland.</p>
        ) : (
          <ul className="entry-related-list">
            {linkedCultures.map((row) => (
              <li key={row.entryId} className="entry-related-row">
                <span className="entry-related-name">{row.name}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return null;
}
