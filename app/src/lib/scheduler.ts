// Répétition espacée — SM-2, la variante utilisée par Anki et SuperMemo 2.
//
// Pourquoi SM-2 et pas un intervalle fixe : l'intervalle utile dépend de la
// difficulté RESSENTIE au rappel, pas du calendrier. Une carte facile doit
// s'espacer vite, une carte ratée doit revenir le lendemain quel que soit son
// historique. C'est exactement ce que le facteur de facilité encode.
//
// Écart assumé avec SM-2 d'origine : les notes vont de 0 à 3 (« À revoir »,
// « Difficile », « Correct », « Facile ») plutôt que 0-5. Quatre boutons, c'est
// ce qu'un humain distingue de façon fiable ; six invitent à sur-réfléchir.

export type ReviewGrade = 0 | 1 | 2 | 3;

export type CardState = {
  cardId: string;
  /** Facteur de facilité SM-2. Plus il est haut, plus les intervalles s'allongent. */
  easeFactor: number;
  /** Intervalle courant, en jours. */
  intervalDays: number;
  /** Nombre de rappels réussis d'affilée. Remis à zéro sur un échec. */
  repetitions: number;
  /** Date ISO (AAAA-MM-JJ) du prochain passage. */
  dueOn: string;
  lastReviewedAt: string | null;
  /** Compteurs de suivi, utiles pour repérer une carte mal écrite. */
  totalReviews: number;
  lapses: number;
};

export const gradeLabels: Record<ReviewGrade, string> = {
  0: "À revoir",
  1: "Difficile",
  2: "Correct",
  3: "Facile",
};

const MIN_EASE = 1.3;
const DEFAULT_EASE = 2.5;

export function today(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function newCardState(cardId: string, now = new Date()): CardState {
  return {
    cardId,
    easeFactor: DEFAULT_EASE,
    intervalDays: 0,
    repetitions: 0,
    dueOn: today(now),
    lastReviewedAt: null,
    totalReviews: 0,
    lapses: 0,
  };
}

/**
 * Applique une note à une carte et renvoie son nouvel état.
 * Fonction pure : aucune date implicite, aucun accès au stockage — c'est ce qui
 * la rend testable et rejouable.
 */
export function gradeCard(state: CardState, grade: ReviewGrade, now = new Date()): CardState {
  const day = today(now);

  // Échec : la carte repasse demain et repart de zéro. On ne garde que la
  // pénalité d'ease, pour que les cartes chroniquement ratées reviennent plus
  // souvent que les autres.
  if (grade === 0) {
    return {
      ...state,
      repetitions: 0,
      intervalDays: 1,
      easeFactor: Math.max(MIN_EASE, state.easeFactor - 0.2),
      dueOn: addDays(day, 1),
      lastReviewedAt: now.toISOString(),
      totalReviews: state.totalReviews + 1,
      lapses: state.lapses + 1,
    };
  }

  const repetitions = state.repetitions + 1;

  // La formule SM-2, transposée sur l'échelle 0-3. Une note « Correct » (2)
  // laisse l'ease inchangé ; « Facile » l'augmente, « Difficile » l'abaisse.
  const easeDelta = { 1: -0.15, 2: 0, 3: 0.1 }[grade];
  const easeFactor = Math.max(MIN_EASE, state.easeFactor + easeDelta);

  // Les deux premiers intervalles sont fixes : SM-2 n'a pas encore assez de
  // signal pour calculer quoi que ce soit d'utile.
  const intervalDays =
    repetitions === 1 ? 1 :
    repetitions === 2 ? 6 :
    Math.round(state.intervalDays * easeFactor);

  // « Difficile » ne doit pas envoyer la carte à trois semaines : on plafonne.
  const adjusted = grade === 1 ? Math.max(1, Math.round(intervalDays * 0.6)) : intervalDays;

  return {
    ...state,
    repetitions,
    easeFactor,
    intervalDays: adjusted,
    dueOn: addDays(day, adjusted),
    lastReviewedAt: now.toISOString(),
    totalReviews: state.totalReviews + 1,
  };
}

/** Les cartes dues aujourd'hui ou en retard, les plus en retard d'abord. */
export function dueCards(states: CardState[], now = new Date()): CardState[] {
  const day = today(now);
  return states
    .filter((state) => state.dueOn <= day)
    .sort((a, b) => a.dueOn.localeCompare(b.dueOn));
}

/** Aperçu de l'intervalle qu'une note produirait, pour l'afficher sur le bouton. */
export function previewInterval(state: CardState, grade: ReviewGrade): string {
  const next = gradeCard(state, grade);
  if (next.intervalDays === 1) return "demain";
  if (next.intervalDays < 30) return `dans ${next.intervalDays} j`;
  const months = Math.round(next.intervalDays / 30);
  return months < 12 ? `dans ${months} mois` : `dans ${Math.round(months / 12)} an(s)`;
}

/** Répartition de la file à venir, pour la vue d'ensemble des révisions. */
export function upcomingLoad(states: CardState[], days = 7, now = new Date()) {
  const start = today(now);
  return Array.from({ length: days }, (_, offset) => {
    const date = addDays(start, offset);
    return {
      date,
      // Le jour 0 absorbe tout le retard accumulé : c'est ce qui est réellement
      // à faire aujourd'hui, pas seulement ce qui échoit aujourd'hui.
      count: states.filter((state) => (offset === 0 ? state.dueOn <= date : state.dueOn === date)).length,
    };
  });
}
