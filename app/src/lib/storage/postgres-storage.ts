// Le pilote Postgres — Supabase, Railway, Neon ou un serveur à soi.
//
// Utile dès qu'on veut sa progression sur plusieurs appareils, ou qu'on déploie
// l'app. Le schéma est dans app/sql/001_schema.sql ; il est aussi rejoué ici au
// premier appel (CREATE TABLE IF NOT EXISTS), pour que l'app fonctionne même si
// personne n'a lancé psql.

import { Pool } from "pg";

import type { CardState } from "@/lib/scheduler";
import type { LessonProgress } from "@/lib/lesson-progress";
import type { Storage, StoredAnswer } from "./types";

let pool: Pool | null = null;
let schemaReady: Promise<void> | null = null;

function getPool(): Pool {
  if (pool) return pool;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("STORAGE_DRIVER=postgres mais DATABASE_URL est vide.");

  pool = new Pool({
    connectionString,
    // Supabase, Neon et Railway exigent TLS mais servent des certificats que
    // Node ne valide pas contre son magasin par défaut. `rejectUnauthorized:
    // false` chiffre le transport sans exiger la chaîne — c'est la posture
    // documentée par ces trois hébergeurs.
    ssl: process.env.PGSSL === "require" || /supabase|neon|railway/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
    max: 4,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
  });
  return pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id        TEXT PRIMARY KEY,
  source_url       TEXT NOT NULL,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS card_states (
  card_id          TEXT PRIMARY KEY,
  ease_factor      REAL NOT NULL DEFAULT 2.5,
  interval_days    INTEGER NOT NULL DEFAULT 0,
  repetitions      INTEGER NOT NULL DEFAULT 0,
  due_on           DATE NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at TIMESTAMPTZ,
  total_reviews    INTEGER NOT NULL DEFAULT 0,
  lapses           INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS card_states_due_idx ON card_states (due_on);

CREATE TABLE IF NOT EXISTS subject_notes (
  subject_id TEXT PRIMARY KEY,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exercise_answers (
  id         TEXT PRIMARY KEY,
  lesson_id  TEXT NOT NULL,
  subject_id TEXT NOT NULL,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  feedback   TEXT,
  provider   TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS exercise_answers_created_idx ON exercise_answers (created_at DESC);
`;

// Une seule migration par processus, même si dix requêtes arrivent ensemble.
function ensureSchema(): Promise<void> {
  schemaReady ??= getPool().query(SCHEMA).then(() => undefined);
  return schemaReady;
}

type ProgressRow = {
  lesson_id: string;
  source_url: string;
  position_seconds: number;
  duration_seconds: number;
  completed: boolean;
  completed_at: Date | null;
  last_watched_at: Date | null;
};

function toProgress(row: ProgressRow): LessonProgress {
  return {
    lessonId: row.lesson_id,
    sourceUrl: row.source_url,
    positionSeconds: row.position_seconds,
    durationSeconds: row.duration_seconds,
    completed: row.completed,
    completedAt: row.completed_at?.toISOString() ?? null,
    lastWatchedAt: row.last_watched_at?.toISOString() ?? null,
  };
}

type CardRow = {
  card_id: string;
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_on: Date | string;
  last_reviewed_at: Date | null;
  total_reviews: number;
  lapses: number;
};

function toCardState(row: CardRow): CardState {
  return {
    cardId: row.card_id,
    easeFactor: Number(row.ease_factor),
    intervalDays: row.interval_days,
    repetitions: row.repetitions,
    // `date` revient en Date via pg ; on le ramène toujours en AAAA-MM-JJ, la
    // forme que manipule le scheduler.
    dueOn: row.due_on instanceof Date ? row.due_on.toISOString().slice(0, 10) : String(row.due_on).slice(0, 10),
    lastReviewedAt: row.last_reviewed_at?.toISOString() ?? null,
    totalReviews: row.total_reviews,
    lapses: row.lapses,
  };
}

export function createPostgresStorage(): Storage {
  return {
    driver: "postgres",

    async getProgress(lessonId) {
      await ensureSchema();
      const { rows } = await getPool().query<ProgressRow>(
        "SELECT * FROM lesson_progress WHERE lesson_id = $1",
        [lessonId],
      );
      return rows[0] ? toProgress(rows[0]) : null;
    },

    async saveProgress(progress) {
      await ensureSchema();
      const { rows } = await getPool().query<ProgressRow>(
        `INSERT INTO lesson_progress
           (lesson_id, source_url, position_seconds, duration_seconds, completed, completed_at, last_watched_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (lesson_id) DO UPDATE SET
           source_url       = EXCLUDED.source_url,
           position_seconds = EXCLUDED.position_seconds,
           duration_seconds = GREATEST(lesson_progress.duration_seconds, EXCLUDED.duration_seconds),
           completed        = lesson_progress.completed OR EXCLUDED.completed,
           -- Une leçon terminée le reste : on garde la première date.
           completed_at     = COALESCE(lesson_progress.completed_at, EXCLUDED.completed_at),
           last_watched_at  = NOW()
         RETURNING *`,
        [
          progress.lessonId,
          progress.sourceUrl,
          progress.positionSeconds,
          progress.durationSeconds,
          progress.completed,
          progress.completed ? new Date() : null,
        ],
      );
      return toProgress(rows[0]);
    },

    async listProgress() {
      await ensureSchema();
      const { rows } = await getPool().query<ProgressRow>("SELECT * FROM lesson_progress");
      return rows.map(toProgress);
    },

    async getCardStates() {
      await ensureSchema();
      const { rows } = await getPool().query<CardRow>("SELECT * FROM card_states");
      return rows.map(toCardState);
    },

    async saveCardState(state) {
      await ensureSchema();
      const { rows } = await getPool().query<CardRow>(
        `INSERT INTO card_states
           (card_id, ease_factor, interval_days, repetitions, due_on, last_reviewed_at, total_reviews, lapses)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (card_id) DO UPDATE SET
           ease_factor      = EXCLUDED.ease_factor,
           interval_days    = EXCLUDED.interval_days,
           repetitions      = EXCLUDED.repetitions,
           due_on           = EXCLUDED.due_on,
           last_reviewed_at = EXCLUDED.last_reviewed_at,
           total_reviews    = EXCLUDED.total_reviews,
           lapses           = EXCLUDED.lapses
         RETURNING *`,
        [
          state.cardId,
          state.easeFactor,
          state.intervalDays,
          state.repetitions,
          state.dueOn,
          state.lastReviewedAt,
          state.totalReviews,
          state.lapses,
        ],
      );
      return toCardState(rows[0]);
    },

    async getNote(subjectId) {
      await ensureSchema();
      const { rows } = await getPool().query<{ body: string }>(
        "SELECT body FROM subject_notes WHERE subject_id = $1",
        [subjectId],
      );
      return rows[0]?.body ?? "";
    },

    async saveNote(subjectId, body) {
      await ensureSchema();
      await getPool().query(
        `INSERT INTO subject_notes (subject_id, body, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (subject_id) DO UPDATE SET body = EXCLUDED.body, updated_at = NOW()`,
        [subjectId, body],
      );
    },

    async listNotes() {
      await ensureSchema();
      const { rows } = await getPool().query<{ subject_id: string; body: string }>(
        "SELECT subject_id, body FROM subject_notes",
      );
      return Object.fromEntries(rows.map((row) => [row.subject_id, row.body]));
    },

    async appendAnswer(answer) {
      await ensureSchema();
      await getPool().query(
        `INSERT INTO exercise_answers (id, lesson_id, subject_id, question, answer, feedback, provider, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [answer.id, answer.lessonId, answer.subjectId, answer.question, answer.answer, answer.feedback, answer.provider],
      );
      return answer;
    },

    async listAnswers(limit = 50) {
      await ensureSchema();
      const { rows } = await getPool().query<{
        id: string; lesson_id: string; subject_id: string; question: string;
        answer: string; feedback: string | null; provider: string; created_at: Date;
      }>("SELECT * FROM exercise_answers ORDER BY created_at DESC LIMIT $1", [limit]);
      return rows.map((row) => ({
        id: row.id,
        lessonId: row.lesson_id,
        subjectId: row.subject_id,
        question: row.question,
        answer: row.answer,
        feedback: row.feedback,
        provider: row.provider,
        createdAt: row.created_at.toISOString(),
      }));
    },

    async ping() {
      await ensureSchema();
      await getPool().query("SELECT 1");
      return true;
    },
  };
}
