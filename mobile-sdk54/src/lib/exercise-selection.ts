import type { Exercise } from '@/types/scio';

export function selectNextExercise(
  exercises: Exercise[],
  passedExerciseIds: string[],
): Exercise | null {
  const passed = new Set(passedExerciseIds);
  return exercises.find(({ id }) => !passed.has(id)) ?? null;
}
