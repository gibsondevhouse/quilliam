/**
 * LibraryDashboard — shared TypeScript interfaces.
 */
export interface ModuleStat {
  count: number;
  lastUpdated?: number;
  openIssues?: number;
}

export interface BookCardStat {
  id: string;
  title: string;
  status: "drafting" | "editing" | "archived";
  chapters: number;
  scenes: number;
  lastEdited?: number;
  notes: string;
}

export interface ModuleCardConfig {
  key: string;
  label: string;
  path: string;
  description: string;
  cta: string;
  icon: string;
}

export interface ModuleSectionConfig {
  key: string;
  label: string;
  cards: ModuleCardConfig[];
}

export interface SearchItem {
  id: string;
  label: string;
  hint: string;
  icon: string;
  href?: string;
  onSelect?: () => void;
}

export interface QuickAddAction {
  id: string;
  label: string;
  hint: string;
  action: () => void;
}

export const STATUS_LABELS = {
  drafting: "Drafting",
  editing: "Editing",
  archived: "Archived",
} as const;

export const STATUS_COLORS = {
  drafting: "#3b82f6",
  editing: "#f59e0b",
  archived: "#6b7280",
} as const;

export const EMPTY_STAT: ModuleStat = { count: 0, openIssues: 0 };
