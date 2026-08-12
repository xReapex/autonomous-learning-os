export type RewardEventKind = "lesson_completed" | "exercise_succeeded" | "card_recalled";
export type RewardTierId = "seed" | "scholar" | "expert" | "master";

export type RewardEvent = {
  eventId: string;
  kind: RewardEventKind;
  occurredAt: string;
  subjectId: string;
  itemId: string;
};

export type ForgivingStreak = {
  current: number;
  longest: number;
  lastActiveOn: string | null;
  graceUsed: boolean;
};

export type RewardTier = {
  id: RewardTierId;
  minimumXp: number;
  nextTierAt: number | null;
};

export type RewardState = {
  version: 1;
  totalXp: number;
  masteryPoints: number;
  masteryLevel: number;
  streak: ForgivingStreak;
  tier: RewardTier;
  updatedAt: string | null;
};

export type RewardDelta = { xp: number; mastery: number };

export type RewardGrant = {
  eventId: string;
  kind: RewardEventKind;
  awarded: boolean;
  reward: RewardDelta;
  tierUnlocked: RewardTierId | null;
  state: RewardState;
};

const REWARDS: Record<RewardEventKind, RewardDelta> = {
  lesson_completed: { xp: 100, mastery: 20 },
  exercise_succeeded: { xp: 60, mastery: 12 },
  card_recalled: { xp: 25, mastery: 5 },
};

const TIERS: readonly Omit<RewardTier, "nextTierAt">[] = [
  { id: "seed", minimumXp: 0 },
  { id: "scholar", minimumXp: 250 },
  { id: "expert", minimumXp: 750 },
  { id: "master", minimumXp: 1500 },
];

const MASTERY_THRESHOLDS = [0, 100, 250, 500, 1000] as const;

export function tierForXp(value: number): RewardTier {
  const xp = Math.max(0, Math.floor(value));
  let index = 0;
  for (let cursor = 1; cursor < TIERS.length; cursor += 1) {
    if (xp < TIERS[cursor].minimumXp) break;
    index = cursor;
  }
  return {
    ...TIERS[index],
    nextTierAt: TIERS[index + 1]?.minimumXp ?? null,
  };
}

export function masteryLevelFor(value: number): number {
  const points = Math.max(0, Math.floor(value));
  let level = 0;
  for (let index = 1; index < MASTERY_THRESHOLDS.length; index += 1) {
    if (points < MASTERY_THRESHOLDS[index]) break;
    level = index;
  }
  return level;
}

export function emptyRewardState(): RewardState {
  return {
    version: 1,
    totalXp: 0,
    masteryPoints: 0,
    masteryLevel: 0,
    streak: { current: 0, longest: 0, lastActiveOn: null, graceUsed: false },
    tier: tierForXp(0),
    updatedAt: null,
  };
}

export function normalizeRewardState(input: unknown): RewardState {
  if (!input || typeof input !== "object" || Array.isArray(input)) return emptyRewardState();
  const value = input as Partial<RewardState>;
  const totalXp = Number.isFinite(value.totalXp) ? Math.max(0, Math.floor(value.totalXp!)) : 0;
  const masteryPoints = Number.isFinite(value.masteryPoints) ? Math.max(0, Math.floor(value.masteryPoints!)) : 0;
  const streak = value.streak && typeof value.streak === "object" ? value.streak : emptyRewardState().streak;
  const current = Number.isFinite(streak.current) ? Math.max(0, Math.floor(streak.current)) : 0;
  const longest = Number.isFinite(streak.longest) ? Math.max(current, Math.floor(streak.longest)) : current;
  const lastActiveOn = typeof streak.lastActiveOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(streak.lastActiveOn)
    ? streak.lastActiveOn
    : null;
  return {
    version: 1,
    totalXp,
    masteryPoints,
    masteryLevel: masteryLevelFor(masteryPoints),
    streak: { current, longest, lastActiveOn, graceUsed: streak.graceUsed === true },
    tier: tierForXp(totalXp),
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : null,
  };
}

function calendarDay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("RewardEvent.occurredAt doit être une date ISO valide.");
  return date.toISOString().slice(0, 10);
}

function dayDistance(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

export function updateForgivingStreak(streak: ForgivingStreak, occurredAt: string): ForgivingStreak {
  const activeOn = calendarDay(occurredAt);
  if (!streak.lastActiveOn) return { current: 1, longest: Math.max(1, streak.longest), lastActiveOn: activeOn, graceUsed: false };

  const distance = dayDistance(streak.lastActiveOn, activeOn);
  if (distance <= 0) return streak;

  const continues = distance === 1 || (distance === 2 && !streak.graceUsed);
  const current = continues ? streak.current + 1 : 1;
  return {
    current,
    longest: Math.max(streak.longest, current),
    lastActiveOn: activeOn,
    graceUsed: continues && (streak.graceUsed || distance === 2),
  };
}

export function applyRewardEvent(current: RewardState, event: RewardEvent): {
  state: RewardState;
  reward: RewardDelta;
  tierUnlocked: RewardTierId | null;
} {
  if (!event.eventId.trim()) throw new Error("RewardEvent.eventId est obligatoire.");
  if (!event.subjectId.trim() || !event.itemId.trim()) throw new Error("RewardEvent doit référencer son curriculum.");
  const state = normalizeRewardState(current);
  const reward = REWARDS[event.kind];
  if (!reward) throw new Error("RewardEvent.kind est inconnu.");
  const totalXp = state.totalXp + reward.xp;
  const masteryPoints = state.masteryPoints + reward.mastery;
  const tier = tierForXp(totalXp);
  return {
    reward: { ...reward },
    tierUnlocked: tier.id === state.tier.id ? null : tier.id,
    state: {
      version: 1,
      totalXp,
      masteryPoints,
      masteryLevel: masteryLevelFor(masteryPoints),
      streak: updateForgivingStreak(state.streak, event.occurredAt),
      tier,
      updatedAt: new Date(event.occurredAt).toISOString(),
    },
  };
}

export function duplicateRewardGrant(event: RewardEvent, state: RewardState): RewardGrant {
  return {
    eventId: event.eventId,
    kind: event.kind,
    awarded: false,
    reward: { xp: 0, mastery: 0 },
    tierUnlocked: null,
    state: normalizeRewardState(state),
  };
}
