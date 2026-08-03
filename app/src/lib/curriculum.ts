// Le curriculum est une DONNÉE, pas du code : il vient de content/curriculum.json,
// écrit par la deep research. Ce module le charge, le normalise et le rend
// typé au reste de l'app.
//
// Choix : import JSON statique plutôt que lecture disque. Le curriculum ne
// change pas pendant qu'une session tourne, et l'import statique le rend
// disponible côté client sans aller-retour réseau.

import raw from "../../content/curriculum.json";

export type SourceKind = "video" | "reading" | "interactive";

export type LessonSource = {
  title: string;
  provider: string;
  kind: SourceKind;
  url: string;
  embedUrl?: string;
  totalMinutes?: number;
  minutes: number;
  why: string;
  access: "free";
  accessNote: string;
  verifiedAt: string;
  segmentLabel: string;
  segmentStartSeconds: number;
};

export type Lesson = {
  id: string;
  title: string;
  objective: string;
  keyTakeaways: string[];
  prompt: string;
  source: LessonSource;
  alternatives: LessonSource[];
};

export type Subject = {
  id: string;
  icon: string;
  title: string;
  level: string;
  progress: number;
  lessons: Lesson[];
  /** Raccourci vers la leçon courante — celle que l'app présente par défaut. */
  lesson: Lesson;
};

export type ReviewCard = {
  id: string;
  type: string;
  front: string;
  back: string;
  subjectId?: string;
  lessonId?: string;
};

export type Curriculum = {
  subject: string;
  goal: string;
  level: string;
  sessionMinutes: number;
  generatedAt: string;
  language: string;
  subjects: Subject[];
  cards: ReviewCard[];
};

type RawSource = Omit<LessonSource, "segmentStartSeconds"> & { segmentStartSeconds?: number };
type RawLesson = Omit<Lesson, "source" | "alternatives"> & {
  source: RawSource;
  alternatives?: RawSource[];
};
type RawSubject = Omit<Subject, "lesson" | "progress" | "lessons"> & {
  progress?: number;
  lessons: RawLesson[];
};

function normalizeSource(source: RawSource): LessonSource {
  return { ...source, segmentStartSeconds: source.segmentStartSeconds ?? 0 };
}

function normalizeLesson(lesson: RawLesson): Lesson {
  return {
    ...lesson,
    source: normalizeSource(lesson.source),
    alternatives: (lesson.alternatives ?? []).map(normalizeSource),
  };
}

function normalizeSubject(subject: RawSubject): Subject {
  const lessons = subject.lessons.map(normalizeLesson);
  return {
    ...subject,
    progress: subject.progress ?? 0,
    lessons,
    lesson: lessons[0],
  };
}

const document = raw as unknown as {
  subject: string;
  goal: string;
  level?: string;
  sessionMinutes?: number;
  generatedAt: string;
  language?: string;
  subjects: RawSubject[];
  cards: ReviewCard[];
};

export const curriculum: Curriculum = {
  subject: document.subject,
  goal: document.goal,
  level: document.level ?? "debutant",
  sessionMinutes: document.sessionMinutes ?? 30,
  generatedAt: document.generatedAt,
  language: document.language ?? "fr",
  subjects: document.subjects.map(normalizeSubject),
  cards: document.cards,
};

export const subjects = curriculum.subjects;
export const dailyCards = curriculum.cards;

export function subjectById(id: string): Subject {
  return subjects.find((subject) => subject.id === id) ?? subjects[0];
}

export function lessonById(lessonId: string): { subject: Subject; lesson: Lesson } | undefined {
  for (const subject of subjects) {
    const lesson = subject.lessons.find((item) => item.id === lessonId);
    if (lesson) return { subject, lesson };
  }
  return undefined;
}

/** Toutes les leçons, à plat, dans l'ordre du cursus. */
export function allLessons(): { subject: Subject; lesson: Lesson }[] {
  return subjects.flatMap((subject) => subject.lessons.map((lesson) => ({ subject, lesson })));
}

/** Combien de sources ont été vérifiées, et à quelle date la plus ancienne. */
export function sourceAudit() {
  const sources = allLessons().map(({ lesson }) => lesson.source);
  const dates = sources.map((source) => source.verifiedAt).sort();
  return {
    total: sources.length,
    providers: new Set(sources.map((source) => source.provider)).size,
    oldestVerification: dates[0] ?? curriculum.generatedAt,
    newestVerification: dates[dates.length - 1] ?? curriculum.generatedAt,
  };
}
