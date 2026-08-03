// La forme d'une session. Le temps disponible change les VOLUMES, jamais la
// boucle : rappel → capsule → pratique → bilan. Doubler le temps ne double pas
// le temps de vidéo — il va d'abord dans la pratique, qui est ce qui laisse une
// trace (docs/LEARNING-SCIENCE.md).

export type StudyBlockKind = "review" | "learn" | "practice" | "reflect" | "break";

export type StudyBlock = { kind: StudyBlockKind; minutes: number };
export type StudyPlan = { totalMinutes: number; blocks: StudyBlock[] };
export type ScheduledStudyBlock = StudyBlock & { startsAtMinute: number; endsAtMinute: number };

export const studyDurations = [15, 30, 45, 60, 90, 120, 180] as const;
export type StudyDuration = (typeof studyDurations)[number];

const SESSION_TEMPLATES: Record<number, StudyBlock[]> = {
  15: [
    { kind: "review", minutes: 3 },
    { kind: "learn", minutes: 7 },
    { kind: "practice", minutes: 3 },
    { kind: "reflect", minutes: 2 },
  ],
  30: [
    { kind: "review", minutes: 7 },
    { kind: "learn", minutes: 10 },
    { kind: "practice", minutes: 8 },
    { kind: "reflect", minutes: 5 },
  ],
  45: [
    { kind: "review", minutes: 10 },
    { kind: "learn", minutes: 15 },
    { kind: "practice", minutes: 14 },
    { kind: "reflect", minutes: 6 },
  ],
  60: [
    { kind: "review", minutes: 12 },
    { kind: "learn", minutes: 20 },
    { kind: "practice", minutes: 20 },
    { kind: "reflect", minutes: 8 },
  ],
  90: [
    { kind: "review", minutes: 15 },
    { kind: "learn", minutes: 25 },
    { kind: "break", minutes: 5 },
    { kind: "practice", minutes: 30 },
    { kind: "reflect", minutes: 15 },
  ],
  120: [
    { kind: "review", minutes: 18 },
    { kind: "learn", minutes: 34 },
    { kind: "break", minutes: 6 },
    { kind: "practice", minutes: 42 },
    { kind: "reflect", minutes: 20 },
  ],
  180: [
    { kind: "review", minutes: 25 },
    { kind: "learn", minutes: 50 },
    { kind: "break", minutes: 10 },
    { kind: "practice", minutes: 65 },
    { kind: "reflect", minutes: 30 },
  ],
};

export const blockLabels: Record<StudyBlockKind, string> = {
  review: "Rappel",
  learn: "Capsule",
  practice: "Pratique",
  break: "Pause",
  reflect: "Bilan",
};

export const blockCopy: Record<StudyBlockKind, string> = {
  review: "Réponds aux cartes dues sans ouvrir tes notes.",
  learn: "Regarde uniquement le segment indiqué, avec une question en tête.",
  practice: "Explique, applique, puis cherche une limite au modèle.",
  break: "Bouge, regarde au loin. Ne remplace pas la pause par un écran.",
  reflect: "Écris ce que tu retiens et la prochaine question à résoudre.",
};

export function buildStudyPlan({ minutes, dueCards }: { minutes: number; dueCards: number }): StudyPlan {
  const nearestDuration = Object.keys(SESSION_TEMPLATES)
    .map(Number)
    .sort((a, b) => Math.abs(a - minutes) - Math.abs(b - minutes))[0];

  const blocks = SESSION_TEMPLATES[nearestDuration].map((block) => ({ ...block }));

  // Une file de révision qui déborde vole du temps à la capsule, pas à la
  // pratique : mieux vaut consolider ce qui est déjà là que d'empiler du neuf.
  const review = blocks.find((block) => block.kind === "review");
  if (review && dueCards > 24 && nearestDuration >= 45) {
    const learn = blocks.find((block) => block.kind === "learn");
    if (learn && learn.minutes > 7) {
      review.minutes += 3;
      learn.minutes -= 3;
    }
  }

  return {
    totalMinutes: blocks.reduce((total, block) => total + block.minutes, 0),
    blocks,
  };
}

export function scheduleStudyPlan(plan: StudyPlan): ScheduledStudyBlock[] {
  let cursor = 0;
  return plan.blocks.map((block) => {
    const scheduled = { ...block, startsAtMinute: cursor, endsAtMinute: cursor + block.minutes };
    cursor = scheduled.endsAtMinute;
    return scheduled;
  });
}
