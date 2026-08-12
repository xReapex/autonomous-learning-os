import type { Progress, ScioData } from '@/types/scio';

export function reconcileProgress(previous: Progress, replacement: ScioData): Progress {
  const lessonIds = new Set(
    replacement.curriculum.course.modules.flatMap(({ lessons }) => lessons.map(({ id }) => id)),
  );
  const exerciseIds = new Set(replacement.exercises.map(({ id }) => id));
  const cardIds = new Set(replacement.cards.map(({ id }) => id));

  return {
    completedLessonIds: [...new Set(previous.completedLessonIds.filter((id) => lessonIds.has(id)))],
    passedExerciseIds: [...new Set(previous.passedExerciseIds.filter((id) => exerciseIds.has(id)))],
    recalledCardIds: [...new Set(previous.recalledCardIds.filter((id) => cardIds.has(id)))],
    weeklyLessons: previous.weeklyLessons,
    weeklyReviews: previous.weeklyReviews,
  };
}
