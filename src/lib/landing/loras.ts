/**
 * LoRA types and localStorage persistence layer.
 *
 * LoRAs are assistant presets — analogous to GPTs.
 * They persist as localStorage JSON for MVP, easily migrated to IDB later.
 */

export interface LoRA {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  isDefault?: boolean;
  createdAt: number;
  updatedAt: number;
  /** Advanced: override the local model used for this LoRA */
  modelOverride?: string;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

export const DEFAULT_LORA_ID = "default-balanced";

export const DEFAULT_LORAS: LoRA[] = [
  {
    id: DEFAULT_LORA_ID,
    name: "Default (Balanced)",
    description: "Balanced general-purpose writing assistant.",
    systemPrompt:
      "You are Quilliam, a skilled writing assistant. Help the user with any creative writing task — brainstorming, drafting, outlining, worldbuilding, and editing. Be concise, thoughtful, and always in service of their creative vision.",
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "continuity-editor",
    name: "Continuity Editor",
    description: "Checks for plot holes, timeline inconsistencies, and character continuity.",
    systemPrompt:
      "You are a Continuity Editor. Focus on logical consistency across the manuscript: timeline accuracy, character trait consistency, plot coherence, and internal world rules. Flag issues clearly and suggest fixes.",
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "worldbuilder",
    name: "Worldbuilder",
    description: "Deep lore, geography, culture, and history design.",
    systemPrompt:
      "You are a Worldbuilder. Specialise in creating rich, believable fictional worlds: geography, cultures, history, politics, economies, magic systems, and religions. Think systematically and create internally consistent details.",
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "scene-drafter",
    name: "Scene Drafter",
    description: "Writes and refines individual scenes with strong pacing and voice.",
    systemPrompt:
      "You are a Scene Drafter. Focus on prose craft: pacing, sensory detail, dialogue, point of view, and emotional resonance. Draft scenes based on user descriptions and refine them on request.",
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: "outline-architect",
    name: "Outline Architect",
    description: "Structures stories, chapters, and series arcs.",
    systemPrompt:
      "You are an Outline Architect. Specialise in story structure: three-act, save the cat, seven-point, hero's journey, and custom frameworks. Help plan novels, series, and individual chapters at any level of detail.",
    isDefault: true,
    createdAt: 0,
    updatedAt: 0,
  },
];

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

const USER_LORAS_KEY = "quilliam_user_loras";

function loadUserLoRAs(): LoRA[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USER_LORAS_KEY);
    return raw ? (JSON.parse(raw) as LoRA[]) : [];
  } catch {
    return [];
  }
}

export function saveUserLoRAs(loras: LoRA[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USER_LORAS_KEY, JSON.stringify(loras));
}

/** Returns default LoRAs merged with any user-created ones. */
export function loadLoRAs(): LoRA[] {
  return [...DEFAULT_LORAS, ...loadUserLoRAs()];
}
