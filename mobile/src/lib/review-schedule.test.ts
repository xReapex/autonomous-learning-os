import { describe, expect, it } from 'vitest';

import { demoData } from '../services/demo-data';
import { selectDueCards } from './review-schedule';

describe('review due-card selection', () => {
  it('keeps only due, unrecalled cards ordered by due date', () => {
    const [first, second] = demoData.cards;
    const cards = [
      { ...first, id: 'future', dueAt: '2026-08-12T09:00:00.000Z' },
      { ...second, id: 'due-later', dueAt: '2026-08-10T08:00:00.000Z' },
      { ...first, id: 'due-first', dueAt: '2026-08-09T08:00:00.000Z' },
      { ...second, id: 'recalled', dueAt: '2026-08-08T08:00:00.000Z' },
    ];

    expect(selectDueCards(cards, ['recalled'], new Date('2026-08-10T10:00:00.000Z')).map(({ id }) => id))
      .toEqual(['due-first', 'due-later']);
  });
});
