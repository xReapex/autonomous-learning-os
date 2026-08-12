import { describe, expect, it } from 'vitest';

import {
  applyReward,
  createInitialRewardState,
  isRewardEventType,
  milestoneDefinitions,
} from './rewards';

describe('adult rewards', () => {
  it('accepts only the three explicit learning outcomes', () => {
    expect(isRewardEventType('lesson_completed')).toBe(true);
    expect(isRewardEventType('exercise_passed')).toBe(true);
    expect(isRewardEventType('review_recalled')).toBe(true);
    expect(isRewardEventType('screen_opened')).toBe(false);
    expect(isRewardEventType('navigation')).toBe(false);
  });

  it('grants the defined XP and mastery for a completed lesson', () => {
    const result = applyReward(createInitialRewardState(), {
      eventId: 'lesson:critical-thinking:completed',
      type: 'lesson_completed',
      occurredAt: '2026-08-10T08:00:00.000Z',
    });

    expect(result.gained).toBe(true);
    expect(result.xpGained).toBe(40);
    expect(result.state.xp).toBe(40);
    expect(result.state.mastery).toBe(4);
    expect(result.state.streak.count).toBe(1);
  });

  it('is idempotent by eventId', () => {
    const event = {
      eventId: 'exercise:logic-1:passed',
      type: 'exercise_passed' as const,
      occurredAt: '2026-08-10T08:00:00.000Z',
    };
    const first = applyReward(createInitialRewardState(), event);
    const duplicate = applyReward(first.state, event);

    expect(duplicate.gained).toBe(false);
    expect(duplicate.xpGained).toBe(0);
    expect(duplicate.state).toEqual(first.state);
  });

  it('keeps a forgiving streak when one calendar day is missed', () => {
    const dayOne = applyReward(createInitialRewardState(), {
      eventId: 'review:1',
      type: 'review_recalled',
      occurredAt: '2026-08-08T18:00:00.000Z',
    });
    const afterOneMissedDay = applyReward(dayOne.state, {
      eventId: 'review:2',
      type: 'review_recalled',
      occurredAt: '2026-08-10T07:00:00.000Z',
    });
    const afterTwoMissedDays = applyReward(afterOneMissedDay.state, {
      eventId: 'review:3',
      type: 'review_recalled',
      occurredAt: '2026-08-13T07:00:00.000Z',
    });

    expect(afterOneMissedDay.state.streak.count).toBe(2);
    expect(afterTwoMissedDays.state.streak.count).toBe(1);
  });

  it('does not increment the streak twice on the same day and unlocks XP milestones', () => {
    const initial = {
      ...createInitialRewardState(),
      xp: 90,
      mastery: 99,
    };
    const first = applyReward(initial, {
      eventId: 'review:morning',
      type: 'review_recalled',
      occurredAt: '2026-08-10T07:00:00.000Z',
    });
    const second = applyReward(first.state, {
      eventId: 'review:evening',
      type: 'review_recalled',
      occurredAt: '2026-08-10T19:00:00.000Z',
    });

    expect(first.state.unlockedMilestoneIds).toContain(milestoneDefinitions[0].id);
    expect(first.newMilestoneIds).toEqual([milestoneDefinitions[0].id]);
    expect(second.state.streak.count).toBe(1);
    expect(second.state.mastery).toBe(100);
  });
});
