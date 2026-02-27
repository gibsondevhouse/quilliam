import type { NodeType } from "@/lib/rag/hierarchy";

export interface SidebarNode {
  id: string;
  title: string;
  type: NodeType;
  children: SidebarNode[];
  isExpanded?: boolean;
  sceneDocId?: string;
}
