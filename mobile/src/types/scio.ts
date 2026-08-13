import type { Locale } from '../lib/i18n';

export type LocalizedText = Record<Locale, string>;

export type YouTubeVideoResource = {
  kind: 'video';
  language: Locale;
  title: string;
  provider: string;
  youtubeId: string;
  url: string;
  embedUrl: string;
  durationMinutes: number;
};

export type Lesson = {
  id: string;
  title: LocalizedText;
  summary: LocalizedText;
  durationMinutes: number;
  videos: Partial<Record<Locale, YouTubeVideoResource>>;
};

export type CourseModule = {
  id: string;
  title: LocalizedText;
  lessons: Lesson[];
};

export type Curriculum = {
  learnerName?: string;
  exercises?: Exercise[];
  course: {
    id: string;
    language?: Locale;
    title: LocalizedText;
    description: LocalizedText;
    modules: CourseModule[];
  };
};

export type ExerciseOption = {
  id: string;
  label: LocalizedText;
};

export type Exercise = {
  id: string;
  question: LocalizedText;
  options: ExerciseOption[];
  correctOptionId: string;
  hint: LocalizedText;
};

export type ReviewCard = {
  id: string;
  front: LocalizedText;
  back: LocalizedText;
  dueAt: string;
};

export type Progress = {
  completedLessonIds: string[];
  passedExerciseIds: string[];
  recalledCardIds: string[];
  weeklyLessons: number;
  weeklyReviews: number;
};

export type ScioData = {
  curriculumRevision?: string;
  curriculum: Curriculum;
  exercises: Exercise[];
  cards: ReviewCard[];
  progress: Progress;
};

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale];
}
