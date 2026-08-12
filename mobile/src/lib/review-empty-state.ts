export type ReviewEmptyState = 'active' | 'no_cards' | 'up_to_date';

export function reviewEmptyState(totalCards: number, dueCards: number): ReviewEmptyState {
  if (totalCards === 0) return 'no_cards';
  return dueCards === 0 ? 'up_to_date' : 'active';
}
