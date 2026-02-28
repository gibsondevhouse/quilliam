import type { ContinuityIssue, Entry, Mention } from "@/lib/types";

export interface ContinuityCheckContext {
  universeId: string;
  entries: Entry[];
  mentions: Mention[];
}

function makeIssueId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createIssue(input: Omit<ContinuityIssue, "id" | "createdAt" | "updatedAt">): ContinuityIssue {
  const now = Date.now();
  return { ...input, id: makeIssueId("issue"), createdAt: now, updatedAt: now };
}

/**
 * Check: two canonical entries in same universe cannot share identical slug.
 */
export function detectDuplicateCanonicalNames(ctx: ContinuityCheckContext): ContinuityIssue[] {
  const seen = new Map<string, Entry[]>();
  for (const entry of ctx.entries) {
    if (entry.canonStatus !== "canon") continue;
    const key = `${entry.entryType}::${entry.slug}`;
    const bucket = seen.get(key) ?? [];
    bucket.push(entry);
    seen.set(key, bucket);
  }

  const issues: ContinuityIssue[] = [];
  for (const group of seen.values()) {
    if (group.length < 2) continue;
    issues.push(
      createIssue({
        universeId: ctx.universeId,
        severity: "warning",
        status: "open",
        checkType: "duplicate-canonical-name",
        description: `Duplicate canonical slug detected: ${group[0].slug}`,
        evidence: group.map((entry) => ({ type: "entry", id: entry.id, excerpt: entry.name })),
      }),
    );
  }

  return issues;
}

/**
 * Check: scene mentions should resolve to known entry IDs.
 */
export function detectBrokenMentionReferences(ctx: ContinuityCheckContext): ContinuityIssue[] {
  const entryIds = new Set(ctx.entries.map((entry) => entry.id));
  const broken = ctx.mentions.filter((mention) => !entryIds.has(mention.entryId));

  return broken.map((mention) =>
    createIssue({
      universeId: ctx.universeId,
      severity: "warning",
      status: "open",
      checkType: "broken-mention-reference",
      description: `Mention ${mention.id} references missing entry ${mention.entryId}`,
      evidence: [
        { type: "mention", id: mention.id },
        { type: "entry", id: mention.entryId },
      ],
    }),
  );
}

/**
 * Check: scene appears after death when a scene/event contains a participant with
 * `details.deathEventId` that precedes the scene's linked event.
 *
 * This is intentionally conservative in V1.5: if timing cannot be resolved, skip.
 */
export function detectDeathBeforeAppearance(ctx: ContinuityCheckContext): ContinuityIssue[] {
  const issues: ContinuityIssue[] = [];

  const byId = new Map(ctx.entries.map((entry) => [entry.id, entry] as const));
  const eventDay = new Map<string, number>();
  for (const entry of ctx.entries) {
    if (entry.entryType !== "timeline_event") continue;
    const day = Number(entry.details.relativeDay ?? entry.details.relative_day ?? Number.NaN);
    if (!Number.isFinite(day)) continue;
    eventDay.set(entry.id, day);
  }

  for (const scene of ctx.entries) {
    if (scene.entryType !== "scene") continue;
    const sceneEventId = String(scene.details.eventId ?? scene.details.timelineEventId ?? "");
    if (!sceneEventId || !eventDay.has(sceneEventId)) continue;
    const sceneDay = eventDay.get(sceneEventId)!;

    const participantIds = Array.isArray(scene.details.presentCharacters)
      ? (scene.details.presentCharacters as string[])
      : [];

    for (const participantId of participantIds) {
      const character = byId.get(participantId);
      if (!character) continue;
      const deathId = String(character.details.deathEventId ?? "");
      if (!deathId || !eventDay.has(deathId)) continue;
      const deathDay = eventDay.get(deathId)!;
      if (sceneDay <= deathDay) continue;

      issues.push(
        createIssue({
          universeId: ctx.universeId,
          severity: "blocker",
          status: "open",
          checkType: "death-before-appearance",
          description: `${character.name} appears after recorded death event`,
          evidence: [
            { type: "scene", id: scene.id, excerpt: scene.name },
            { type: "entry", id: character.id, excerpt: character.name },
            { type: "event", id: deathId, excerpt: "death event" },
          ],
        }),
      );
    }
  }

  return issues;
}

export function runDeterministicContinuityChecks(ctx: ContinuityCheckContext): ContinuityIssue[] {
  return [
    ...detectDuplicateCanonicalNames(ctx),
    ...detectBrokenMentionReferences(ctx),
    ...detectDeathBeforeAppearance(ctx),
  ];
}
