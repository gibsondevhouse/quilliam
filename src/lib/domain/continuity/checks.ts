import type { ContinuityIssue, CultureMembership, Entry, Mention } from "@/lib/types";

export interface ContinuityCheckContext {
  universeId: string;
  entries: Entry[];
  mentions: Mention[];
  cultureMemberships?: CultureMembership[];
}

function makeIssueId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function createIssue(input: Omit<ContinuityIssue, "id" | "createdAt" | "updatedAt">): ContinuityIssue {
  const now = Date.now();
  return { ...input, id: makeIssueId("issue"), createdAt: now, updatedAt: now };
}

function timelineEventDayIndex(entries: Entry[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const entry of entries) {
    if (entry.entryType !== "timeline_event") continue;
    const day = Number(entry.details.relativeDay ?? entry.details.relative_day ?? Number.NaN);
    if (!Number.isFinite(day)) continue;
    index.set(entry.id, day);
  }
  return index;
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
 * Check: if multiple timeline events share the same title/day, their descriptions
 * should not diverge.
 */
export function detectConflictingTimelineEvents(ctx: ContinuityCheckContext): ContinuityIssue[] {
  const buckets = new Map<string, Entry[]>();
  for (const entry of ctx.entries) {
    if (entry.entryType !== "timeline_event") continue;
    const day = Number(entry.details.relativeDay ?? entry.details.relative_day ?? Number.NaN);
    const dayKey = Number.isFinite(day)
      ? `day:${day}`
      : `date:${String(entry.details.date ?? "")}`;
    const key = `${entry.name.toLowerCase()}::${dayKey}`;
    const list = buckets.get(key) ?? [];
    list.push(entry);
    buckets.set(key, list);
  }

  const issues: ContinuityIssue[] = [];
  for (const entries of buckets.values()) {
    if (entries.length < 2) continue;
    const signatures = new Set(
      entries.map((entry) => {
        const body = (entry.bodyMd ?? "").trim();
        const summary = entry.summary.trim();
        return `${summary}||${body}`;
      }),
    );
    if (signatures.size < 2) continue;

    issues.push(
      createIssue({
        universeId: ctx.universeId,
        severity: "warning",
        status: "open",
        checkType: "timeline-event-conflict",
        description: `Timeline event "${entries[0].name}" has conflicting descriptions for the same date`,
        evidence: entries.map((entry) => ({ type: "event", id: entry.id, excerpt: entry.summary || entry.name })),
      }),
    );
  }

  return issues;
}

/**
 * Check: overlapping primary culture memberships should be explicit dual heritage.
 */
export function detectCultureMembershipOverlap(ctx: ContinuityCheckContext): ContinuityIssue[] {
  const memberships = ctx.cultureMemberships ?? [];
  if (memberships.length < 2) return [];

  const eventDayById = timelineEventDayIndex(ctx.entries);
  const entriesById = new Map(ctx.entries.map((entry) => [entry.id, entry] as const));
  const byCharacter = new Map<string, CultureMembership[]>();

  for (const membership of memberships) {
    if (membership.membershipKind !== "primary") continue;
    const list = byCharacter.get(membership.characterEntryId) ?? [];
    list.push(membership);
    byCharacter.set(membership.characterEntryId, list);
  }

  const issues: ContinuityIssue[] = [];
  for (const [characterEntryId, rows] of byCharacter) {
    if (rows.length < 2) continue;

    for (let i = 0; i < rows.length; i += 1) {
      for (let j = i + 1; j < rows.length; j += 1) {
        const a = rows[i];
        const b = rows[j];
        if (a.dualHeritage || b.dualHeritage) continue;
        if (!a.validFromEventId || !b.validFromEventId) continue;

        const startA = eventDayById.get(a.validFromEventId);
        const startB = eventDayById.get(b.validFromEventId);
        if (startA === undefined || startB === undefined) continue;
        const endA = a.validToEventId ? eventDayById.get(a.validToEventId) : undefined;
        const endB = b.validToEventId ? eventDayById.get(b.validToEventId) : undefined;
        if (a.validToEventId && endA === undefined) continue;
        if (b.validToEventId && endB === undefined) continue;

        const overlapStart = Math.max(startA, startB);
        const overlapEnd = Math.min(
          endA ?? Number.POSITIVE_INFINITY,
          endB ?? Number.POSITIVE_INFINITY,
        );
        if (overlapStart > overlapEnd) continue;

        const characterName = entriesById.get(characterEntryId)?.name ?? characterEntryId;
        const cultureA = entriesById.get(a.cultureEntryId)?.name ?? a.cultureEntryId;
        const cultureB = entriesById.get(b.cultureEntryId)?.name ?? b.cultureEntryId;

        issues.push(
          createIssue({
            universeId: ctx.universeId,
            severity: "warning",
            status: "open",
            checkType: "culture-membership-overlap",
            description: `${characterName} has overlapping primary cultures (${cultureA} and ${cultureB}) without dual_heritage flag`,
            evidence: [
              { type: "entry", id: characterEntryId, excerpt: characterName },
              { type: "culture_membership", id: a.id, excerpt: cultureA },
              { type: "culture_membership", id: b.id, excerpt: cultureB },
            ],
          }),
        );
      }
    }
  }

  return issues;
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
    ...detectConflictingTimelineEvents(ctx),
    ...detectCultureMembershipOverlap(ctx),
    ...detectDeathBeforeAppearance(ctx),
  ];
}
