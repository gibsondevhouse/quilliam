import type { NodeType } from "@/lib/rag/hierarchy";

export const TYPE_ICONS: Record<NodeType, string> = {
  library: "📚",
  series: "🌐",
  book: "📖",
  section: "◆",
  chapter: "§",
  scene: "¶",
  fragment: "·",
};

export const TYPE_LABELS: Record<NodeType, string> = {
  library: "Library",
  series: "Series",
  book: "Book",
  section: "Section",
  chapter: "Chapter",
  scene: "Scene",
  fragment: "Fragment",
};
