import { describe, expect, it } from "vitest";

import { buildStudyPlan, scheduleStudyPlan, studyDurations } from "./study-plan";

describe("buildStudyPlan", () => {
  it("garde la boucle complète pour chaque durée proposée", () => {
    for (const minutes of studyDurations) {
      const plan = buildStudyPlan({ minutes, dueCards: 6 });
      const kinds = plan.blocks.map((block) => block.kind);

      // La boucle est le produit : aucune durée ne doit dégénérer en simple
      // visionnage.
      expect(kinds).toContain("review");
      expect(kinds).toContain("learn");
      expect(kinds).toContain("practice");
      expect(kinds).toContain("reflect");
      expect(plan.totalMinutes).toBe(minutes);
    }
  });

  it("consacre au moins autant de temps à la pratique qu'à la vidéo dès 60 minutes", () => {
    // C'est la règle de fond : le temps supplémentaire va dans ce qui laisse
    // une trace — produire, résoudre, vérifier — pas dans plus de visionnage.
    for (const minutes of [60, 90, 120, 180]) {
      const plan = buildStudyPlan({ minutes, dueCards: 0 });
      const learn = plan.blocks.find((block) => block.kind === "learn")!.minutes;
      const practice = plan.blocks.find((block) => block.kind === "practice")!.minutes;
      expect(practice).toBeGreaterThanOrEqual(learn);
    }
  });

  it("garde la pratique à parité avec la capsule sur les formats courts", () => {
    for (const minutes of [30, 45]) {
      const plan = buildStudyPlan({ minutes, dueCards: 0 });
      const learn = plan.blocks.find((block) => block.kind === "learn")!.minutes;
      const practice = plan.blocks.find((block) => block.kind === "practice")!.minutes;
      // En dessous d'une heure, la capsule ne peut pas descendre sous un seuil
      // utile ; la pratique reste à sa hauteur, jamais résiduelle.
      expect(practice / learn).toBeGreaterThan(0.75);
    }
  });

  it("insère une pause sur les sessions longues", () => {
    for (const minutes of [90, 120, 180]) {
      expect(buildStudyPlan({ minutes, dueCards: 0 }).blocks.some((block) => block.kind === "break")).toBe(true);
    }
    expect(buildStudyPlan({ minutes: 30, dueCards: 0 }).blocks.some((block) => block.kind === "break")).toBe(false);
  });

  it("prend le temps sur la capsule, pas sur la pratique, quand la file déborde", () => {
    const light = buildStudyPlan({ minutes: 60, dueCards: 4 });
    const heavy = buildStudyPlan({ minutes: 60, dueCards: 40 });

    const reviewOf = (plan: typeof light) => plan.blocks.find((block) => block.kind === "review")!.minutes;
    const learnOf = (plan: typeof light) => plan.blocks.find((block) => block.kind === "learn")!.minutes;
    const practiceOf = (plan: typeof light) => plan.blocks.find((block) => block.kind === "practice")!.minutes;

    expect(reviewOf(heavy)).toBeGreaterThan(reviewOf(light));
    expect(learnOf(heavy)).toBeLessThan(learnOf(light));
    expect(practiceOf(heavy)).toBe(practiceOf(light));
    expect(heavy.totalMinutes).toBe(60);
  });

  it("s'aligne sur le gabarit le plus proche pour une durée inconnue", () => {
    expect(buildStudyPlan({ minutes: 33, dueCards: 0 }).totalMinutes).toBe(30);
    expect(buildStudyPlan({ minutes: 200, dueCards: 0 }).totalMinutes).toBe(180);
  });
});

describe("scheduleStudyPlan", () => {
  it("enchaîne les blocs sans trou ni chevauchement", () => {
    const schedule = scheduleStudyPlan(buildStudyPlan({ minutes: 90, dueCards: 0 }));

    expect(schedule[0].startsAtMinute).toBe(0);
    for (let i = 1; i < schedule.length; i += 1) {
      expect(schedule[i].startsAtMinute).toBe(schedule[i - 1].endsAtMinute);
    }
    expect(schedule[schedule.length - 1].endsAtMinute).toBe(90);
  });
});
