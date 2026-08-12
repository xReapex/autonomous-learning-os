import { describe, expect, it } from "vitest";

import { curriculumDurationDecision, shouldApplyCurriculumDuration, storedDurationPreference } from "./study-context";

describe("préférence de durée runtime", () => {
  it("conserve une préférence explicitement personnalisée", () => {
    expect(storedDurationPreference({ duration: 30, durationCustomized: true })).toBe(30);
  });

  it("ignore l'ancien 30 minutes auto-écrit mais conserve une ancienne durée personnalisée", () => {
    expect(storedDurationPreference({ duration: 30 })).toBeUndefined();
    expect(storedDurationPreference({ duration: 45 })).toBe(45);
  });

  it("applique le défaut curriculum uniquement à un chrono inactif non personnalisé", () => {
    expect(shouldApplyCurriculumDuration(false, false)).toBe(true);
    expect(shouldApplyCurriculumDuration(true, false)).toBe(false);
    expect(shouldApplyCurriculumDuration(false, true)).toBe(false);
  });

  it("met en attente une nouvelle durée pendant le chrono puis l'applique à l'arrêt", () => {
    expect(curriculumDurationDecision({
      customized: false,
      running: true,
      curriculumChanged: true,
      curriculumMinutes: 45,
      pendingMinutes: null,
    })).toEqual({ applyMinutes: null, pendingMinutes: 45 });

    expect(curriculumDurationDecision({
      customized: false,
      running: false,
      curriculumChanged: false,
      curriculumMinutes: 45,
      pendingMinutes: 45,
    })).toEqual({ applyMinutes: 45, pendingMinutes: null });

    expect(curriculumDurationDecision({
      customized: false,
      running: false,
      curriculumChanged: false,
      curriculumMinutes: 45,
      pendingMinutes: null,
    })).toEqual({ applyMinutes: null, pendingMinutes: null });
  });
});
