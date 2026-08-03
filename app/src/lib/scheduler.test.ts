import { describe, expect, it } from "vitest";

import {
  addDays,
  dueCards,
  gradeCard,
  newCardState,
  previewInterval,
  upcomingLoad,
} from "./scheduler";

const NOW = new Date("2026-08-03T09:00:00Z");

describe("gradeCard", () => {
  it("renvoie une carte ratée dès le lendemain, quel que soit son historique", () => {
    // Une carte bien installée (60 jours d'intervalle) qu'on rate ne doit pas
    // revenir dans deux mois : c'est tout l'intérêt du reset.
    const mature = { ...newCardState("c1"), repetitions: 6, intervalDays: 60, easeFactor: 2.6 };
    const next = gradeCard(mature, 0, NOW);

    expect(next.intervalDays).toBe(1);
    expect(next.dueOn).toBe("2026-08-04");
    expect(next.repetitions).toBe(0);
    expect(next.lapses).toBe(1);
  });

  it("suit la progression SM-2 : 1 jour, puis 6, puis l'ease", () => {
    let state = newCardState("c2");

    state = gradeCard(state, 2, NOW);
    expect(state.intervalDays).toBe(1);

    state = gradeCard(state, 2, NOW);
    expect(state.intervalDays).toBe(6);

    state = gradeCard(state, 2, NOW);
    expect(state.intervalDays).toBe(15); // 6 × 2.5
  });

  it("ne descend jamais l'ease sous le plancher SM-2", () => {
    let state = { ...newCardState("c3"), easeFactor: 1.35 };
    for (let i = 0; i < 5; i += 1) state = gradeCard(state, 0, NOW);
    expect(state.easeFactor).toBe(1.3);
  });

  it("raccourcit l'intervalle sur « Difficile » sans remettre à zéro", () => {
    const state = { ...newCardState("c4"), repetitions: 3, intervalDays: 20, easeFactor: 2.5 };
    const hard = gradeCard(state, 1, NOW);
    const good = gradeCard(state, 2, NOW);

    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(hard.repetitions).toBe(4);
    expect(hard.easeFactor).toBeLessThan(state.easeFactor);
  });

  it("récompense « Facile » par un ease plus élevé", () => {
    const state = newCardState("c5");
    expect(gradeCard(state, 3, NOW).easeFactor).toBeGreaterThan(state.easeFactor);
  });
});

describe("dueCards", () => {
  it("prend les cartes en retard et celles du jour, les plus anciennes d'abord", () => {
    const states = [
      { ...newCardState("late"), dueOn: "2026-07-28" },
      { ...newCardState("today"), dueOn: "2026-08-03" },
      { ...newCardState("future"), dueOn: "2026-08-10" },
    ];

    const due = dueCards(states, NOW);
    expect(due.map((state) => state.cardId)).toEqual(["late", "today"]);
  });
});

describe("upcomingLoad", () => {
  it("regroupe tout le retard sur le premier jour", () => {
    const states = [
      { ...newCardState("a"), dueOn: "2026-07-01" },
      { ...newCardState("b"), dueOn: "2026-07-15" },
      { ...newCardState("c"), dueOn: "2026-08-05" },
    ];

    const load = upcomingLoad(states, 7, NOW);
    expect(load[0]).toEqual({ date: "2026-08-03", count: 2 });
    expect(load.find((day) => day.date === "2026-08-05")?.count).toBe(1);
  });
});

describe("addDays", () => {
  it("franchit correctement une fin de mois", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
  });
});

describe("previewInterval", () => {
  it("annonce un intervalle lisible plutôt qu'un nombre de jours brut", () => {
    const state = { ...newCardState("p"), repetitions: 4, intervalDays: 40, easeFactor: 2.5 };
    expect(previewInterval(state, 0)).toBe("demain");
    expect(previewInterval(state, 2)).toMatch(/mois|an/);
  });
});
