import { describe, expect, it } from 'vitest';

import { resolveIndeterminateOffset } from './progress-animation';

describe('indeterminate progress animation geometry', () => {
  it('moves a 34% segment across the remaining 66% of the track', () => {
    expect(resolveIndeterminateOffset(300, 0, false)).toBe(0);
    expect(resolveIndeterminateOffset(300, 0.5, false)).toBeCloseTo(99);
    expect(resolveIndeterminateOffset(300, 1, false)).toBeCloseTo(198);
  });

  it('centers the segment when reduced motion is enabled', () => {
    expect(resolveIndeterminateOffset(300, 0, true)).toBeCloseTo(99);
    expect(resolveIndeterminateOffset(300, 1, true)).toBeCloseTo(99);
  });

  it('clamps invalid widths and phases', () => {
    expect(resolveIndeterminateOffset(-100, 0.5, false)).toBe(0);
    expect(resolveIndeterminateOffset(300, -1, false)).toBe(0);
    expect(resolveIndeterminateOffset(300, 2, false)).toBeCloseTo(198);
  });
});
