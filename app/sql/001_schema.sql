-- BizOS × Learning — schéma Postgres
--
-- Appliqué par scripts/03-database.sh, ou rejoué automatiquement par l'app au
-- premier démarrage. Tout est IF NOT EXISTS : relançable sans risque.

CREATE TABLE IF NOT EXISTS lesson_progress (
  lesson_id        TEXT PRIMARY KEY,
  source_url       TEXT NOT NULL,
  position_seconds INTEGER NOT NULL DEFAULT 0,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  completed        BOOLEAN NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ,
  last_watched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Répétition espacée : un état SM-2 par carte.
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

-- La file du jour se lit par date d'échéance : c'est la seule requête chaude.
CREATE INDEX IF NOT EXISTS card_states_due_idx ON card_states (due_on);

CREATE TABLE IF NOT EXISTS subject_notes (
  subject_id TEXT PRIMARY KEY,
  body       TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- L'historique des exercices. Append-only : une réponse passée est une trace
-- d'apprentissage, pas un brouillon à écraser.
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
