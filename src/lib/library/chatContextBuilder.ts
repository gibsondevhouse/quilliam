import type { CanonicalDoc, CharacterEntry, LocationEntry, WorldEntry } from "@/lib/types";

interface BuildChatContextInput {
  libraryTitle: string;
  activeTabId: string | null;
  docContents: Record<string, { title: string; content: string }>;
  workingContents: Record<string, string>;
  characters: CharacterEntry[];
  locations: LocationEntry[];
  worldEntries: WorldEntry[];
  entityDrafts: Record<string, string>;
  /**
   * Canonical docs from the store, included as a concise entity roster so the
   * model can reference already-established facts and the patch extractor can
   * perform name-matching against the same entities.
   */
  canonicalDocs?: CanonicalDoc[];
}

export function buildChatContext(input: BuildChatContextInput): string {
  const {
    libraryTitle,
    activeTabId,
    docContents,
    workingContents,
    characters,
    locations,
    worldEntries,
    entityDrafts,
    canonicalDocs,
  } = input;

  const lines: string[] = [];
  lines.push(`### Library: ${libraryTitle}`);

  if (activeTabId && docContents[activeTabId]) {
    const doc = docContents[activeTabId];
    lines.push(`\n### Active Document: ${doc.title}`);
    const content = workingContents[activeTabId] ?? doc.content;
    if (content) {
      lines.push("```");
      lines.push(content.slice(0, 3000));
      if (content.length > 3000) lines.push("… (truncated)");
      lines.push("```");
    }
  }

  if (characters.length > 0) {
    lines.push("\n### Characters (editable via file=character:<name>)");
    characters.slice(0, 15).forEach((character) => {
      const notes = entityDrafts[`character:${character.name}`] ?? character.notes;
      const parts = [character.name || "Unnamed"];
      if (character.role) parts.push(`(${character.role})`);
      if (notes) parts.push(`— ${notes.slice(0, 120)}`);
      lines.push(`- ${parts.join(" ")}`);
    });
  }

  if (locations.length > 0) {
    lines.push("\n### Locations (editable via file=location:<name>)");
    locations.slice(0, 10).forEach((location) => {
      const description = entityDrafts[`location:${location.name}`] ?? location.description;
      lines.push(
        `- ${location.name || "Unnamed"}${description ? ` — ${description.slice(0, 120)}` : ""}`.trimEnd(),
      );
    });
  }

  if (worldEntries.length > 0) {
    lines.push("\n### World (editable via file=world:<title>)");
    worldEntries.slice(0, 10).forEach((entry) => {
      const notes = entityDrafts[`world:${entry.title}`] ?? entry.notes;
      lines.push(
        `- ${entry.title || "Untitled"}${entry.category ? ` (${entry.category})` : ""}${notes ? ` — ${notes.slice(0, 120)}` : ""}`.trimEnd(),
      );
    });
  }

  if (canonicalDocs && canonicalDocs.length > 0) {
    // Group by type and emit a compact roster so the model knows established entities.
    // Capped at 20 entries total to stay within prefix-cache budget.
    const byType = new Map<string, CanonicalDoc[]>();
    for (const doc of canonicalDocs.slice(0, 20)) {
      const bucket = byType.get(doc.type) ?? [];
      bucket.push(doc);
      byType.set(doc.type, bucket);
    }
    lines.push("\n### Canonical Entities (established — reference only, do not re-introduce)");
    for (const [type, docs] of byType) {
      lines.push(`**${type.replace(/_/g, " ")}**: ${docs.map((d) => d.name).join(", ")}`);
    }
  }

  return lines.join("\n");
}
