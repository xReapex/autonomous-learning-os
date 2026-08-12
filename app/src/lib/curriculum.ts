// Le curriculum est une DONNÉE, pas du code. Le document livré reste le
// fallback immuable ; un document runtime peut être injecté sans rebuild.

import raw from "../../content/curriculum.json";

export type SourceKind = "video";

export type CurriculumSource = {
  title: string;
  provider: string;
  kind: SourceKind;
  language: string;
  url: string;
  embedUrl: string;
  totalMinutes: number;
  minutes: number;
  why: string;
  access: "free";
  accessNote: string;
  verifiedAt: string;
  segmentLabel: string;
  segmentStartSeconds?: number;
};

export type CurriculumLesson = {
  id: string;
  title: string;
  objective: string;
  keyTakeaways: string[];
  prompt: string;
  source: CurriculumSource;
  alternatives?: CurriculumSource[];
};

export type CurriculumSubject = {
  id: string;
  icon: string;
  title: string;
  level: string;
  progress?: number;
  lessons: CurriculumLesson[];
};

export type ReviewCard = {
  id: string;
  type: string;
  front: string;
  back: string;
  subjectId?: string;
  lessonId?: string;
};

export type CurriculumDocument = {
  version: 1;
  subject: string;
  goal: string;
  level?: "debutant" | "intermediaire" | "avance";
  sessionMinutes?: 15 | 30 | 45 | 60 | 90 | 120 | 180;
  generatedAt: string;
  language: string;
  subjects: CurriculumSubject[];
  cards: ReviewCard[];
};

export type LessonSource = Omit<CurriculumSource, "segmentStartSeconds"> & {
  segmentStartSeconds: number;
};

export type Lesson = Omit<CurriculumLesson, "source" | "alternatives"> & {
  source: LessonSource;
  alternatives: LessonSource[];
};

export type Subject = Omit<CurriculumSubject, "progress" | "lessons"> & {
  progress: number;
  lessons: Lesson[];
  /** Raccourci runtime ; il n'est jamais sérialisé dans CurriculumDocument. */
  lesson: Lesson;
};

export type Curriculum = {
  version: 1;
  subject: string;
  goal: string;
  level: "debutant" | "intermediaire" | "avance";
  sessionMinutes: 15 | 30 | 45 | 60 | 90 | 120 | 180;
  generatedAt: string;
  language: string;
  subjects: Subject[];
  cards: ReviewCard[];
};

function normalizeSource(source: CurriculumSource): LessonSource {
  return { ...source, segmentStartSeconds: source.segmentStartSeconds ?? 0 };
}

function normalizeLesson(lesson: CurriculumLesson): Lesson {
  return {
    ...lesson,
    source: normalizeSource(lesson.source),
    alternatives: (lesson.alternatives ?? []).map(normalizeSource),
  };
}

function normalizeSubject(subject: CurriculumSubject): Subject {
  const lessons = subject.lessons.map(normalizeLesson);
  return {
    ...subject,
    progress: subject.progress ?? 0,
    lessons,
    lesson: lessons[0],
  };
}

export const defaultCurriculumDocument = raw as unknown as CurriculumDocument;

export function normalizeCurriculumDocument(document: CurriculumDocument): Curriculum {
  return {
    version: document.version,
    subject: document.subject,
    goal: document.goal,
    level: document.level ?? "debutant",
    sessionMinutes: document.sessionMinutes ?? 30,
    generatedAt: document.generatedAt,
    language: document.language,
    subjects: document.subjects.map(normalizeSubject),
    cards: document.cards.map((card) => ({ ...card })),
  };
}

export const curriculum: Curriculum = normalizeCurriculumDocument(defaultCurriculumDocument);
export const subjects = curriculum.subjects;
export const dailyCards = curriculum.cards;

export function subjectById(id: string, active: Curriculum = curriculum): Subject {
  return active.subjects.find((subject) => subject.id === id) ?? active.subjects[0];
}

export function lessonById(
  lessonId: string,
  active: Curriculum = curriculum,
): { subject: Subject; lesson: Lesson } | undefined {
  for (const subject of active.subjects) {
    const lesson = subject.lessons.find((item) => item.id === lessonId);
    if (lesson) return { subject, lesson };
  }
  return undefined;
}

/** Toutes les leçons, à plat, dans l'ordre du cursus. */
export function allLessons(active: Curriculum = curriculum): { subject: Subject; lesson: Lesson }[] {
  return active.subjects.flatMap((subject) =>
    subject.lessons.map((lesson) => ({ subject, lesson })),
  );
}

/** Combien de sources ont été vérifiées, et à quelle date la plus ancienne. */
export function sourceAudit(active: Curriculum = curriculum) {
  const sources = allLessons(active).map(({ lesson }) => lesson.source);
  const dates = sources.map((source) => source.verifiedAt).sort();
  return {
    total: sources.length,
    providers: new Set(sources.map((source) => source.provider)).size,
    oldestVerification: dates[0] ?? active.generatedAt,
    newestVerification: dates[dates.length - 1] ?? active.generatedAt,
  };
}
