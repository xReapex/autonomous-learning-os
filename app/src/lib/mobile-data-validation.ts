import type { MobileDefaultData } from './mobile-default-data';

export type MobileContent = MobileDefaultData;

export class MobileDataValidationError extends Error {
  constructor() {
    super('mobile_data_invalid');
    this.name = 'MobileDataValidationError';
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function text(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function localized(value: unknown): boolean {
  return record(value) && text(value.fr) && text(value.en);
}

function youtubeVideo(value: unknown, locale: 'fr' | 'en'): boolean {
  if (!record(value) || value.kind !== 'video' || value.language !== locale ||
      !text(value.title) || !text(value.provider) || !text(value.youtubeId) ||
      !text(value.url) || !text(value.embedUrl) || !Number.isInteger(value.durationMinutes) ||
      Number(value.durationMinutes) <= 0 || !/^[A-Za-z0-9_-]{11}$/.test(value.youtubeId)) return false;
  try {
    const watch = new URL(value.url);
    const embed = new URL(value.embedUrl);
    const watchHost = watch.hostname.toLowerCase().replace(/^www\./, '');
    const watchId = watchHost === 'youtu.be'
      ? watch.pathname.slice(1)
      : watch.searchParams.get('v');
    return ['youtube.com', 'm.youtube.com', 'youtu.be'].includes(watchHost) &&
      watchId === value.youtubeId &&
      embed.hostname.toLowerCase().replace(/^www\./, '') === 'youtube-nocookie.com' &&
      embed.pathname === `/embed/${value.youtubeId}`;
  } catch {
    return false;
  }
}

function exercise(value: unknown): boolean {
  if (!record(value) || !text(value.id) || !localized(value.question) || !localized(value.hint) ||
      !text(value.correctOptionId) || !Array.isArray(value.options) || value.options.length < 2) return false;
  return value.options.every((option) => record(option) && text(option.id) && localized(option.label)) &&
    value.options.some((option) => record(option) && option.id === value.correctOptionId);
}

function card(value: unknown): boolean {
  return record(value) && text(value.id) && localized(value.front) && localized(value.back) &&
    text(value.dueAt) && !Number.isNaN(Date.parse(value.dueAt));
}

export function validateMobileContent(value: unknown): MobileContent {
  if (!record(value) || !record(value.curriculum) || !record(value.curriculum.course) ||
      !text(value.curriculum.course.id) || !localized(value.curriculum.course.title) ||
      !localized(value.curriculum.course.description) || !Array.isArray(value.curriculum.course.modules) ||
      value.curriculum.course.modules.length === 0 || !Array.isArray(value.exercises) ||
      !value.exercises.every(exercise) || !Array.isArray(value.cards) || !value.cards.every(card)) {
    throw new MobileDataValidationError();
  }

  const language = value.curriculum.course.language;
  const requiredLocales: Array<'fr' | 'en'> = language === 'fr' || language === 'en'
    ? [language]
    : ['fr', 'en'];
  const modulesValid = value.curriculum.course.modules.every((module) => {
    if (!record(module) || !text(module.id) || !localized(module.title) ||
        !Array.isArray(module.lessons) || module.lessons.length === 0) return false;
    return module.lessons.every((lesson) => {
      if (!record(lesson) || !text(lesson.id) || !localized(lesson.title) || !localized(lesson.summary) ||
          !Number.isInteger(lesson.durationMinutes) || Number(lesson.durationMinutes) <= 0 ||
          !record(lesson.videos)) return false;
      const videos = lesson.videos;
      return requiredLocales.every((locale) => youtubeVideo(videos[locale], locale));
    });
  });
  if (!modulesValid) throw new MobileDataValidationError();

  return {
    curriculum: value.curriculum,
    exercises: value.exercises,
    cards: value.cards,
  } as MobileContent;
}
