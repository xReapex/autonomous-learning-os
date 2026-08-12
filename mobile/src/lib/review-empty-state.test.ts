import { describe, expect, it } from 'vitest';

import { reviewEmptyState } from './review-empty-state';

describe('reviewEmptyState', () => {
  it('distinguishes no generated cards from no review due', () => {
    expect(reviewEmptyState(0, 0)).toBe('no_cards');
    expect(reviewEmptyState(3, 0)).toBe('up_to_date');
  });

  it('keeps the active state while cards are due', () => {
    expect(reviewEmptyState(3, 2)).toBe('active');
  });
});
