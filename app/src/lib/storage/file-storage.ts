// Le pilote par défaut : des fichiers JSON dans .data/.
//
// C'est ce qui permet à l'app de démarrer sans qu'on ait rien configuré. Pas de
// base à provisionner, pas de connexion à ouvrir, et les données restent sur la
// machine de l'utilisateur.
//
// Les écritures sont sérialisées par une file par fichier : deux requêtes
// concurrentes sur la même leçon écriraient sinon l'une par-dessus l'autre
// (lecture-modification-écriture non atomique). L'écriture elle-même passe par
// un fichier temporaire puis un rename, pour qu'une coupure ne laisse jamais un
// JSON tronqué.

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type { CardState } from "@/lib/scheduler";
import type { LessonProgress } from "@/lib/lesson-progress";
import type { Storage, StoredAnswer } from "./types";

const DATA_DIR = process.env.LEARNING_DATA_DIR || join(process.cwd(), ".data");

const FILES = {
  progress: join(DATA_DIR, "progress.json"),
  cards: join(DATA_DIR, "cards.json"),
  notes: join(DATA_DIR, "notes.json"),
  answers: join(DATA_DIR, "answers.json"),
} as const;

// Une chaîne de promesses par fichier : chaque écriture attend la précédente.
const writeQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(file) ?? Promise.resolve();
  const next = previous.then(task, task);
  // On garde une version « qui n'échoue jamais » dans la file, sinon une erreur
  // ferait échouer toutes les écritures suivantes sur ce fichier.
  writeQueues.set(file, next.catch(() => undefined));
  return next;
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT") return fallback;
    // Un fichier corrompu ne doit pas empêcher d'étudier : on repart du vide
    // plutôt que de faire planter la page.
    console.warn(`[storage] ${file} illisible, réinitialisé :`, (error as Error).message);
    return fallback;
  }
}

async function writeJson(file: string, value: unknown) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export function createFileStorage(): Storage {
  return {
    driver: "file",

    async getProgress(lessonId) {
      const all = await readJson<Record<string, LessonProgress>>(FILES.progress, {});
      return all[lessonId] ?? null;
    },

    async saveProgress(progress) {
      return enqueue(FILES.progress, async () => {
        const all = await readJson<Record<string, LessonProgress>>(FILES.progress, {});
        all[progress.lessonId] = progress;
        await writeJson(FILES.progress, all);
        return progress;
      });
    },

    async listProgress() {
      const all = await readJson<Record<string, LessonProgress>>(FILES.progress, {});
      return Object.values(all);
    },

    async getCardStates() {
      const all = await readJson<Record<string, CardState>>(FILES.cards, {});
      return Object.values(all);
    },

    async saveCardState(state) {
      return enqueue(FILES.cards, async () => {
        const all = await readJson<Record<string, CardState>>(FILES.cards, {});
        all[state.cardId] = state;
        await writeJson(FILES.cards, all);
        return state;
      });
    },

    async getNote(subjectId) {
      const all = await readJson<Record<string, string>>(FILES.notes, {});
      return all[subjectId] ?? "";
    },

    async saveNote(subjectId, body) {
      await enqueue(FILES.notes, async () => {
        const all = await readJson<Record<string, string>>(FILES.notes, {});
        all[subjectId] = body;
        await writeJson(FILES.notes, all);
      });
    },

    async listNotes() {
      return readJson<Record<string, string>>(FILES.notes, {});
    },

    async appendAnswer(answer) {
      return enqueue(FILES.answers, async () => {
        const all = await readJson<StoredAnswer[]>(FILES.answers, []);
        all.push(answer);
        // On garde les 500 dernières : un historique d'exercices n'a pas
        // vocation à grossir indéfiniment dans un fichier relu à chaque écriture.
        await writeJson(FILES.answers, all.slice(-500));
        return answer;
      });
    },

    async listAnswers(limit = 50) {
      const all = await readJson<StoredAnswer[]>(FILES.answers, []);
      return all.slice(-limit).reverse();
    },

    async ping() {
      await mkdir(DATA_DIR, { recursive: true });
      return true;
    },
  };
}
