import { describe, expect, it } from 'vitest';

import { reconcileProgress } from './progress-reconciliation';
import type { Progress, ScioData } from '@/types/scio';

const previous: Progress = {
  completedLessonIds: ['lesson-kept', 'lesson-kept', 'lesson-removed'],
  passedExerciseIds: ['exercise-kept', 'exercise-kept', 'exercise-removed'],
  recalledCardIds: ['card-kept', 'card-kept', 'card-removed'],
  weeklyLessons: 4,
  weeklyReviews: 7,
};

const next = {
  curriculum: {
    course: {
      modules: [{ lessons: [{ id: 'lesson-kept' }, { id: 'lesson-new' }] }],
    },
  },
  exercises: [{ id: 'exercise-kept' }, { id: 'exercise-new' }],
  cards: [{ id: 'card-kept' }, { id: 'card-new' }],
} as ScioData;

describe('reconcileProgress', () => {
  it('keeps only progress identifiers that exist in the replacement curriculum', () => {
    expect(reconcileProgress(previous, next)).toEqual({
      completedLessonIds: ['lesson-kept'],
      passedExerciseIds: ['exercise-kept'],
      recalledCardIds: ['card-kept'],
      weeklyLessons: 4,
      weeklyReviews: 7,
    });
  });
});
