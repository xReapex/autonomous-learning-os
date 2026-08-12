import { describe, expect, it } from 'vitest';

import { demoData } from '../services/demo-data';
import type { Curriculum, Lesson } from '../types/scio';

import { getVideoForLocale, validateCurriculumVideos } from './video-resources';

describe('YouTube video resources', () => {
  it('provides one valid YouTube video per supported language for every demo lesson', () => {
    expect(validateCurriculumVideos(demoData.curriculum, ['fr', 'en'])).toEqual([]);
  });

  it('selects only the exact requested language', () => {
    const lesson = demoData.curriculum.course.modules[0].lessons[0];
    expect(getVideoForLocale(lesson, 'fr')?.language).toBe('fr');
    expect(getVideoForLocale(lesson, 'en')?.language).toBe('en');
  });

  it('fails closed instead of falling back to another language', () => {
    const lesson = demoData.curriculum.course.modules[0].lessons[0];
    const frenchOnly = {
      ...lesson,
      videos: { fr: lesson.videos.fr },
    } as unknown as Lesson;
    expect(getVideoForLocale(frenchOnly, 'en')).toBeNull();
  });

  it('rejects reading and non-YouTube resources at runtime', () => {
    const candidate = structuredClone(demoData.curriculum);
    const lesson = candidate.course.modules[0].lessons[0];
    lesson.videos.fr = {
      ...lesson.videos.fr,
      kind: 'reading',
      url: 'https://example.com/article',
    } as unknown as typeof lesson.videos.fr;

    expect(validateCurriculumVideos(candidate as Curriculum, ['fr'])).not.toEqual([]);
  });
});
