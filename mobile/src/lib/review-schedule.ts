import type { ReviewCard } from '../types/scio';

export function selectDueCards(
  cards: ReviewCard[],
  recalledCardIds: string[],
  now = new Date(),
): ReviewCard[] {
  const recalled = new Set(recalledCardIds);
  const nowTime = now.getTime();
  return cards
    .filter((card) => !recalled.has(card.id) && Date.parse(card.dueAt) <= nowTime)
    .sort((left, right) => Date.parse(left.dueAt) - Date.parse(right.dueAt));
}
