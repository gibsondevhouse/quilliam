import type { CharacterEntry, LocationEntry, WorldEntry } from "@/lib/types";

interface BuildChatContextInput {
  libraryTitle: string;
  activeTabId: string | null;
  docContents: Record<string, { title: string; content: string }>;
  workingContents: Record<string, string>;
  characters: CharacterEntry[];
  locations: LocationEntry[];
  worldEntries: WorldEntry[];
  entityDrafts: Record<string, string>;
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

  return lines.join("\n");
}
