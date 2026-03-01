import type { NodeType } from "@/lib/rag/hierarchy";

export interface SidebarNode {
  id: string;
  title: string;
  type: NodeType;
  children: SidebarNode[];
  isExpanded?: boolean;
  sceneDocId?: string;
  /** Optional cover image URL for library thumbnails */
  coverImageUrl?: string;
  /** Number of chapter/section nodes (for library rows) */
  chapterCount?: number;
}
