import { describe, expect, it } from 'vitest';

import { selectNextExercise } from './exercise-selection';
import type { Exercise } from '@/types/scio';

const exercises = [
  { id: 'exercise-1' },
  { id: 'exercise-2' },
  { id: 'exercise-3' },
] as Exercise[];

describe('selectNextExercise', () => {
  it('selects the first exercise not passed yet', () => {
    expect(selectNextExercise(exercises, ['exercise-1'])?.id).toBe('exercise-2');
  });

  it('returns no exercise when the session is complete', () => {
    expect(selectNextExercise(exercises, exercises.map(({ id }) => id))).toBeNull();
  });

  it('returns no exercise for an empty curriculum', () => {
    expect(selectNextExercise([], [])).toBeNull();
  });
});
