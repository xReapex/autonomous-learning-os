export const rewardEventTypes = [
  'lesson_completed',
  'exercise_passed',
  'review_recalled',
] as const;

export type RewardEventType = (typeof rewardEventTypes)[number];

export type RewardEvent = {
  eventId: string;
  type: RewardEventType;
  occurredAt: string;
};

export type RewardState = {
  xp: number;
  mastery: number;
  streak: {
    count: number;
    lastActiveDate: string | null;
  };
  processedEventIds: string[];
  unlockedMilestoneIds: string[];
};

export type RewardResult = {
  state: RewardState;
  gained: boolean;
  xpGained: number;
  masteryGained: number;
  newMilestoneIds: string[];
};

export const milestoneDefinitions = [
  { id: 'spark', xp: 100, nameKey: 'milestone.spark' },
  { id: 'momentum', xp: 300, nameKey: 'milestone.momentum' },
  { id: 'depth', xp: 700, nameKey: 'milestone.depth' },
  { id: 'mastery', xp: 1200, nameKey: 'milestone.mastery' },
] as const;

const rewardValues: Record<RewardEventType, { xp: number; mastery: number }> = {
  lesson_completed: { xp: 40, mastery: 4 },
  exercise_passed: { xp: 25, mastery: 3 },
  review_recalled: { xp: 10, mastery: 2 },
};

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function createInitialRewardState(): RewardState {
  return {
    xp: 0,
    mastery: 0,
    streak: { count: 0, lastActiveDate: null },
    processedEventIds: [],
    unlockedMilestoneIds: [],
  };
}

export function isRewardEventType(value: string): value is RewardEventType {
  return rewardEventTypes.includes(value as RewardEventType);
}

function toUtcDateKey(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    throw new Error('REWARD_DATE_INVALID');
  }
  return date.toISOString().slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const earlierTime = Date.parse(`${earlier}T00:00:00.000Z`);
  const laterTime = Date.parse(`${later}T00:00:00.000Z`);
  return Math.round((laterTime - earlierTime) / millisecondsPerDay);
}

function updateStreak(state: RewardState, activeDate: string): RewardState['streak'] {
  const previousDate = state.streak.lastActiveDate;
  if (!previousDate) {
    return { count: 1, lastActiveDate: activeDate };
  }

  const elapsedDays = daysBetween(previousDate, activeDate);
  if (elapsedDays <= 0) {
    return state.streak;
  }

  return {
    count: elapsedDays <= 2 ? state.streak.count + 1 : 1,
    lastActiveDate: activeDate,
  };
}

export function applyReward(state: RewardState, event: RewardEvent): RewardResult {
  if (!event.eventId.trim()) {
    throw new Error('REWARD_EVENT_ID_REQUIRED');
  }

  if (state.processedEventIds.includes(event.eventId)) {
    return {
      state,
      gained: false,
      xpGained: 0,
      masteryGained: 0,
      newMilestoneIds: [],
    };
  }

  const value = rewardValues[event.type];
  const xp = state.xp + value.xp;
  const mastery = Math.min(100, state.mastery + value.mastery);
  const unlockedMilestoneIds = milestoneDefinitions
    .filter((milestone) => xp >= milestone.xp)
    .map((milestone) => milestone.id);
  const newMilestoneIds = unlockedMilestoneIds.filter(
    (id) => !state.unlockedMilestoneIds.includes(id),
  );

  return {
    state: {
      xp,
      mastery,
      streak: updateStreak(state, toUtcDateKey(event.occurredAt)),
      processedEventIds: [...state.processedEventIds, event.eventId],
      unlockedMilestoneIds,
    },
    gained: true,
    xpGained: value.xp,
    masteryGained: mastery - state.mastery,
    newMilestoneIds,
  };
}
