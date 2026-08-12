import { describe, expect, it } from "vitest";

import {
  applyRewardEvent,
  emptyRewardState,
  masteryLevelFor,
  tierForXp,
  type RewardEvent,
} from "./rewards";

function event(overrides: Partial<RewardEvent> = {}): RewardEvent {
  return {
    eventId: "event-1",
    kind: "lesson_completed",
    occurredAt: "2026-08-01T10:00:00.000Z",
    subjectId: "subject-1",
    itemId: "lesson-1",
    ...overrides,
  };
}

describe("domaine des récompenses SCIO", () => {
  it("attribue des XP et de la maîtrise selon la mutation réelle", () => {
    const lesson = applyRewardEvent(emptyRewardState(), event());
    const exercise = applyRewardEvent(lesson.state, event({
      eventId: "event-2",
      kind: "exercise_succeeded",
      occurredAt: "2026-08-02T10:00:00.000Z",
    }));
    const review = applyRewardEvent(exercise.state, event({
      eventId: "event-3",
      kind: "card_recalled",
      occurredAt: "2026-08-03T10:00:00.000Z",
      itemId: "card-1",
    }));

    expect(lesson.reward).toMatchObject({ xp: 100, mastery: 20 });
    expect(exercise.reward).toMatchObject({ xp: 60, mastery: 12 });
    expect(review.reward).toMatchObject({ xp: 25, mastery: 5 });
    expect(review.state).toMatchObject({ totalXp: 185, masteryPoints: 37 });
  });

  it("accorde un seul jour de grâce à la série puis la réinitialise", () => {
    const first = applyRewardEvent(emptyRewardState(), event());
    const grace = applyRewardEvent(first.state, event({
      eventId: "event-2",
      occurredAt: "2026-08-03T10:00:00.000Z",
    }));
    const reset = applyRewardEvent(grace.state, event({
      eventId: "event-3",
      occurredAt: "2026-08-05T10:00:00.000Z",
    }));

    expect(grace.state.streak).toMatchObject({ current: 2, longest: 2, graceUsed: true, lastActiveOn: "2026-08-03" });
    expect(reset.state.streak).toMatchObject({ current: 1, longest: 2, graceUsed: false, lastActiveOn: "2026-08-05" });
  });

  it("ne compte qu'une activité par jour dans la série", () => {
    const first = applyRewardEvent(emptyRewardState(), event());
    const sameDay = applyRewardEvent(first.state, event({ eventId: "event-2", kind: "card_recalled" }));
    expect(sameDay.state.streak.current).toBe(1);
  });

  it("calcule les paliers XP et les niveaux de maîtrise aux frontières", () => {
    expect(tierForXp(0).id).toBe("seed");
    expect(tierForXp(249).id).toBe("seed");
    expect(tierForXp(250).id).toBe("scholar");
    expect(tierForXp(750).id).toBe("expert");
    expect(tierForXp(1500).id).toBe("master");
    expect(masteryLevelFor(0)).toBe(0);
    expect(masteryLevelFor(100)).toBe(1);
    expect(masteryLevelFor(1000)).toBe(4);
  });
});
