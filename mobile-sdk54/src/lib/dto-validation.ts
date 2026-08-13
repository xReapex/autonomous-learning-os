import { validateCurriculumVideos } from './video-resources';
import type { Curriculum, Exercise, Progress, ReviewCard, ScioData } from '../types/scio';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isLocalizedText(value: unknown): boolean {
  return isRecord(value) && isNonEmptyString(value.fr) && isNonEmptyString(value.en);
}

function isExercise(value: unknown): value is Exercise {
  if (!isRecord(value) || !isNonEmptyString(value.id) || !isLocalizedText(value.question) ||
      !isLocalizedText(value.hint) || !isNonEmptyString(value.correctOptionId) ||
      !Array.isArray(value.options) || value.options.length < 2) return false;
  const optionsValid = value.options.every((option) =>
    isRecord(option) && isNonEmptyString(option.id) && isLocalizedText(option.label));
  return optionsValid && value.options.some((option) =>
    isRecord(option) && option.id === value.correctOptionId);
}

export function parseExercisesDto(value: unknown): Exercise[] {
  if (!Array.isArray(value) || !value.every(isExercise)) throw new Error('DTO_EXERCISES_INVALID');
  return value as Exercise[];
}

export function parseCurriculumDto(value: unknown): Curriculum {
  if (!isRecord(value) || !isRecord(value.course) || !isNonEmptyString(value.course.id) ||
      !isLocalizedText(value.course.title) || !isLocalizedText(value.course.description) ||
      !Array.isArray(value.course.modules) || value.course.modules.length === 0) {
    throw new Error('DTO_CURRICULUM_INVALID');
  }
  const modulesValid = value.course.modules.every((module) =>
    isRecord(module) && isNonEmptyString(module.id) && isLocalizedText(module.title) &&
    Array.isArray(module.lessons) && module.lessons.length > 0 && module.lessons.every((lesson) =>
      isRecord(lesson) && isNonEmptyString(lesson.id) && isLocalizedText(lesson.title) &&
      isLocalizedText(lesson.summary) && Number.isInteger(lesson.durationMinutes) &&
      Number(lesson.durationMinutes) > 0 && isRecord(lesson.videos)));
  const exercisesValid = value.exercises === undefined ||
    (Array.isArray(value.exercises) && value.exercises.every(isExercise));
  const candidate = value as unknown as Curriculum;
  const generatedLanguage = value.course.language;
  const requiredLocales: readonly ('fr' | 'en')[] = generatedLanguage === 'fr' || generatedLanguage === 'en'
    ? [generatedLanguage]
    : ['fr', 'en'];
  if (!modulesValid || !exercisesValid || validateCurriculumVideos(candidate, requiredLocales).length > 0) {
    throw new Error('DTO_CURRICULUM_INVALID');
  }
  return candidate;
}

export function parseCardsDto(value: unknown): ReviewCard[] {
  if (!Array.isArray(value) || !value.every((card) =>
    isRecord(card) && isNonEmptyString(card.id) && isLocalizedText(card.front) &&
    isLocalizedText(card.back) && isNonEmptyString(card.dueAt) &&
    !Number.isNaN(Date.parse(card.dueAt)))) {
    throw new Error('DTO_CARDS_INVALID');
  }
  return value as ReviewCard[];
}

export function parseProgressDto(value: unknown): Progress {
  if (!isRecord(value)) throw new Error('DTO_PROGRESS_INVALID');
  const idArrays = [value.completedLessonIds, value.passedExerciseIds, value.recalledCardIds];
  const counters = [value.weeklyLessons, value.weeklyReviews];
  if (!idArrays.every((ids) => Array.isArray(ids) && ids.every(isNonEmptyString)) ||
      !counters.every((count) => Number.isInteger(count) && Number(count) >= 0)) {
    throw new Error('DTO_PROGRESS_INVALID');
  }
  return value as unknown as Progress;
}

export function parseScioDataDto(value: unknown): ScioData {
  if (!isRecord(value)) {
    throw new Error('DTO_SCIO_DATA_INVALID');
  }
  return {
    ...(typeof value.curriculumRevision === 'string' && /^"[a-f0-9]{64}"$/.test(value.curriculumRevision)
      ? { curriculumRevision: value.curriculumRevision }
      : {}),
    curriculum: parseCurriculumDto(value.curriculum),
    exercises: parseExercisesDto(value.exercises),
    cards: parseCardsDto(value.cards),
    progress: parseProgressDto(value.progress),
  };
}
