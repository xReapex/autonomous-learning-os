import type { CardState } from "@/lib/scheduler";
import type { LessonProgress } from "@/lib/lesson-progress";

/**
 * L'interface que les deux pilotes respectent. L'app n'appelle jamais autre
 * chose : c'est ce qui permet de passer du fichier local à Postgres sans qu'une
 * seule page ne change.
 */
export type Storage = {
  readonly driver: "file" | "postgres";

  getProgress(lessonId: string): Promise<LessonProgress | null>;
  saveProgress(progress: LessonProgress): Promise<LessonProgress>;
  listProgress(): Promise<LessonProgress[]>;

  getCardStates(): Promise<CardState[]>;
  saveCardState(state: CardState): Promise<CardState>;

  getNote(subjectId: string): Promise<string>;
  saveNote(subjectId: string, body: string): Promise<void>;
  listNotes(): Promise<Record<string, string>>;

  appendAnswer(answer: StoredAnswer): Promise<StoredAnswer>;
  listAnswers(limit?: number): Promise<StoredAnswer[]>;

  /** Vérifie que le backend répond. Utilisé par /api/health. */
  ping(): Promise<boolean>;
};

export type StoredAnswer = {
  id: string;
  lessonId: string;
  subjectId: string;
  question: string;
  answer: string;
  feedback: string | null;
  provider: string;
  createdAt: string;
};
