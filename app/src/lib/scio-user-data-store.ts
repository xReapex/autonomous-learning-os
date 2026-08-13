import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { createHash, randomBytes, randomUUID } from 'node:crypto';

import { withInterprocessFileLock } from './interprocess-file-lock';

type Progress = {
  completedLessonIds: string[];
  passedExerciseIds: string[];
  recalledCardIds: string[];
  weeklyLessons: number;
  weeklyReviews: number;
};

type ProgressMutation = {
  eventId: string;
  lessonId?: string;
  exerciseId?: string;
  status: 'completed' | 'passed';
};

type CardMutation = {
  eventId: string;
  cardId: string;
  result: 'recalled' | 'again';
};

type Note = { lessonId: string; body: string };

type CurriculumMutationPrecondition = {
  expectedCurriculumRevision: string;
  fallbackCurriculum?: unknown;
};

type ArchivedCurriculum = {
  courseId: string;
  fingerprint: string;
  curriculum: unknown;
  progress: Progress;
  processedEventIds: string[];
  notes: Note[];
};

type StoredUserData = {
  version: 1;
  progress: Progress;
  processedEventIds: string[];
  notes: Note[];
  curriculum: unknown | null;
  curriculumCleared?: boolean;
  curriculumRevision?: string;
  archivedCurricula?: ArchivedCurriculum[];
};

export class UserDataStoreError extends Error {
  constructor(public readonly code: 'invalid_user_id' | 'storage_invalid' | 'mutation_invalid' | 'curriculum_revision_mismatch' | 'user_deleted') {
    super(code);
    this.name = 'UserDataStoreError';
  }
}

const queues = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = queues.get(file) ?? Promise.resolve();
  const userId = basename(dirname(file));
  const root = dirname(dirname(dirname(file)));
  const lockedTask = () => withInterprocessFileLock(join(root, 'locks', `${userId}.lock`), task);
  const next = previous.then(lockedTask, lockedTask);
  queues.set(file, next.catch(() => undefined));
  return next;
}

function emptyData(): StoredUserData {
  return {
    version: 1,
    progress: {
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    },
    processedEventIds: [],
    notes: [],
    curriculum: null,
    curriculumCleared: false,
    archivedCurricula: [],
  };
}

function courseIdFor(curriculum: unknown): string | null {
  const value = curriculum as { curriculum?: { course?: { id?: unknown } } };
  const courseId = value?.curriculum?.course?.id;
  return typeof courseId === 'string' && courseId.length > 0 && courseId.length <= 200
    ? courseId
    : null;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function curriculumFingerprint(curriculum: unknown): string {
  return createHash('sha256').update(JSON.stringify(canonicalize(curriculum))).digest('hex');
}

const legacyEmptyCurriculumRevision = createHash('sha256')
  .update('scio:curriculum-state:empty:v1')
  .digest('hex');

function curriculumRevision(data: StoredUserData, fallbackCurriculum?: unknown): string | null {
  if (data.curriculumRevision) return data.curriculumRevision;
  if (data.curriculum) return curriculumFingerprint(data.curriculum);
  if (data.curriculumCleared) return legacyEmptyCurriculumRevision;
  return fallbackCurriculum ? curriculumFingerprint(fallbackCurriculum) : null;
}

function nextCurriculumRevision(): string {
  return randomBytes(32).toString('hex');
}

function assertCurriculumPrecondition(
  data: StoredUserData,
  precondition?: CurriculumMutationPrecondition,
): void {
  if (!precondition) return;
  if (curriculumRevision(data, precondition.fallbackCurriculum) !== precondition.expectedCurriculumRevision) {
    throw new UserDataStoreError('curriculum_revision_mismatch');
  }
}

function isArchivedCurriculum(value: unknown): value is ArchivedCurriculum {
  if (!value || typeof value !== 'object') return false;
  const archive = value as Partial<ArchivedCurriculum>;
  const progress = archive.progress as Partial<Progress> | undefined;
  return typeof archive.courseId === 'string' && archive.courseId.length > 0 && archive.courseId.length <= 200 &&
    typeof archive.fingerprint === 'string' && /^[a-f0-9]{64}$/.test(archive.fingerprint) &&
    !!archive.curriculum && typeof archive.curriculum === 'object' && !Array.isArray(archive.curriculum) &&
    courseIdFor(archive.curriculum) === archive.courseId &&
    curriculumFingerprint(archive.curriculum) === archive.fingerprint &&
    !!progress &&
    Array.isArray(progress.completedLessonIds) &&
    Array.isArray(progress.passedExerciseIds) &&
    Array.isArray(progress.recalledCardIds) &&
    Number.isInteger(progress.weeklyLessons) &&
    Number.isInteger(progress.weeklyReviews) &&
    Array.isArray(archive.processedEventIds) &&
    Array.isArray(archive.notes);
}

function assertUserId(userId: string): void {
  if (!/^usr_[a-f0-9]{32}$/.test(userId)) throw new UserDataStoreError('invalid_user_id');
}

function isStoredData(value: unknown): value is StoredUserData {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredUserData>;
  const progress = candidate.progress as Partial<Progress> | undefined;
  return candidate.version === 1 && !!progress &&
    Array.isArray(progress.completedLessonIds) &&
    Array.isArray(progress.passedExerciseIds) &&
    Array.isArray(progress.recalledCardIds) &&
    Number.isInteger(progress.weeklyLessons) &&
    Number.isInteger(progress.weeklyReviews) &&
    Array.isArray(candidate.processedEventIds) &&
    Array.isArray(candidate.notes) &&
    (candidate.curriculumCleared === undefined || typeof candidate.curriculumCleared === 'boolean') &&
    (candidate.curriculumRevision === undefined ||
      (typeof candidate.curriculumRevision === 'string' && /^[a-f0-9]{64}$/.test(candidate.curriculumRevision))) &&
    (candidate.archivedCurricula === undefined ||
      (Array.isArray(candidate.archivedCurricula) && candidate.archivedCurricula.every(isArchivedCurriculum))) &&
    !(candidate.curriculumCleared === true && candidate.curriculum != null) &&
    !(candidate.curriculumCleared === true && (
      progress.completedLessonIds.length > 0 ||
      progress.passedExerciseIds.length > 0 ||
      progress.recalledCardIds.length > 0 ||
      (progress.weeklyLessons as number) > 0 ||
      (progress.weeklyReviews as number) > 0 ||
      candidate.processedEventIds.length > 0 ||
      candidate.notes.length > 0
    )) &&
    (candidate.curriculum === undefined || candidate.curriculum === null || typeof candidate.curriculum === 'object');
}

function hasPedagogicalData(data: StoredUserData): boolean {
  return data.progress.completedLessonIds.length > 0 ||
    data.progress.passedExerciseIds.length > 0 ||
    data.progress.recalledCardIds.length > 0 ||
    data.progress.weeklyLessons > 0 ||
    data.progress.weeklyReviews > 0 ||
    data.processedEventIds.length > 0 ||
    data.notes.length > 0;
}

async function readData(file: string): Promise<StoredUserData> {
  try {
    const value: unknown = JSON.parse(await readFile(file, 'utf8'));
    if (!isStoredData(value)) throw new UserDataStoreError('storage_invalid');
    return {
      ...value,
      curriculum: value.curriculum ?? null,
      curriculumCleared: value.curriculumCleared ?? false,
      archivedCurricula: value.archivedCurricula ?? [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyData();
    if (error instanceof UserDataStoreError) throw error;
    throw new UserDataStoreError('storage_invalid');
  }
}

async function writeData(file: string, value: StoredUserData): Promise<void> {
  await mkdir(dirname(file), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, file);
}

function uniquePush(values: string[], value: string): boolean {
  if (values.includes(value)) return false;
  values.push(value);
  return true;
}

function curriculumObjectIds(curriculum: unknown): {
  lessonIds: Set<string>;
  exerciseIds: Set<string>;
  cardIds: Set<string>;
} {
  const content = curriculum as {
    curriculum?: { course?: { modules?: Array<{ lessons?: Array<{ id?: unknown }> }> } };
    exercises?: Array<{ id?: unknown }>;
    cards?: Array<{ id?: unknown }>;
  };
  const lessonIds = new Set(
    (content.curriculum?.course?.modules ?? [])
      .flatMap((module) => module.lessons ?? [])
      .map((lesson) => lesson.id)
      .filter((id): id is string => typeof id === 'string'),
  );
  const exerciseIds = new Set(
    (content.exercises ?? [])
      .map((exercise) => exercise.id)
      .filter((id): id is string => typeof id === 'string'),
  );
  const cardIds = new Set(
    (content.cards ?? [])
      .map((card) => card.id)
      .filter((id): id is string => typeof id === 'string'),
  );
  return { lessonIds, exerciseIds, cardIds };
}

export function createScioUserDataStore({ dataDirectory }: { dataDirectory: string }) {
  const fileFor = (userId: string) => {
    assertUserId(userId);
    return join(dataDirectory, 'users', userId, 'data.json');
  };
  const deletedMarkerFor = (userId: string) => join(dataDirectory, 'deleted-users', userId);

  async function assertWritableUser(userId: string): Promise<void> {
    try {
      await readFile(deletedMarkerFor(userId), 'utf8');
      throw new UserDataStoreError('user_deleted');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return;
      throw error;
    }
  }

  return {
    async readCurriculum(userId: string): Promise<unknown | null> {
      return (await readData(fileFor(userId))).curriculum;
    },

    async readCurriculumState(userId: string): Promise<
      { status: 'default'; revision: string } |
      { status: 'empty'; revision: string } |
      { status: 'custom'; curriculum: unknown; revision: string }
    > {
      const file = fileFor(userId);
      const current = await readData(file);
      if (!current.curriculum && !current.curriculumCleared && !current.curriculumRevision) {
        return enqueue(file, async () => {
          await assertWritableUser(userId);
          const data = await readData(file);
          if (!data.curriculum && !data.curriculumCleared && !data.curriculumRevision) {
            data.curriculumRevision = nextCurriculumRevision();
            await writeData(file, data);
          }
          if (data.curriculum) {
            return {
              status: 'custom' as const,
              curriculum: data.curriculum,
              revision: curriculumRevision(data) as string,
            };
          }
          return data.curriculumCleared
            ? { status: 'empty' as const, revision: curriculumRevision(data) as string }
            : { status: 'default' as const, revision: data.curriculumRevision as string };
        });
      }
      if (current.curriculum) {
        return {
          status: 'custom',
          curriculum: current.curriculum,
          revision: curriculumRevision(current) as string,
        };
      }
      return current.curriculumCleared
        ? { status: 'empty', revision: curriculumRevision(current) as string }
        : { status: 'default', revision: current.curriculumRevision as string };
    },

    async saveCurriculum(
      userId: string,
      curriculum: unknown,
      precondition?: CurriculumMutationPrecondition,
    ): Promise<string> {
      const file = fileFor(userId);
      if (!curriculum || typeof curriculum !== 'object' || Array.isArray(curriculum)) {
        throw new UserDataStoreError('mutation_invalid');
      }
      return enqueue(file, async () => {
        await assertWritableUser(userId);
        const data = await readData(file);
        assertCurriculumPrecondition(data, precondition);
        const { lessonIds, exerciseIds, cardIds } = curriculumObjectIds(curriculum);
        const courseId = courseIdFor(curriculum);
        const fingerprint = curriculumFingerprint(curriculum);
        const archivedIndex = courseId
          ? (data.archivedCurricula ?? []).findIndex((archive) =>
              archive.courseId === courseId && archive.fingerprint === fingerprint)
          : -1;
        if (archivedIndex >= 0) {
          const [archive] = (data.archivedCurricula ?? []).splice(archivedIndex, 1);
          data.progress = archive.progress;
          data.processedEventIds = archive.processedEventIds;
          data.notes = archive.notes;
        }
        data.curriculum = curriculum;
        data.curriculumCleared = false;
        data.curriculumRevision = nextCurriculumRevision();
        data.progress.completedLessonIds = data.progress.completedLessonIds.filter((id) => lessonIds.has(id));
        data.progress.passedExerciseIds = data.progress.passedExerciseIds.filter((id) => exerciseIds.has(id));
        data.progress.recalledCardIds = data.progress.recalledCardIds.filter((id) => cardIds.has(id));
        data.notes = data.notes.filter((note) => lessonIds.has(note.lessonId));
        await writeData(file, data);
        return data.curriculumRevision;
      });
    },

    async clearCurriculum(
      userId: string,
      fallbackCurriculum?: unknown,
      precondition?: CurriculumMutationPrecondition,
    ): Promise<string> {
      const file = fileFor(userId);
      return enqueue(file, async () => {
        await assertWritableUser(userId);
        const data = await readData(file);
        assertCurriculumPrecondition(data, precondition);
        if (data.curriculumCleared) return curriculumRevision(data) as string;
        const curriculum = data.curriculum ?? fallbackCurriculum ?? null;
        if (!curriculum && hasPedagogicalData(data)) {
          throw new UserDataStoreError('mutation_invalid');
        }
        const courseId = courseIdFor(curriculum);
        if (curriculum && !courseId) throw new UserDataStoreError('mutation_invalid');
        if (curriculum && courseId) {
          const fingerprint = curriculumFingerprint(curriculum);
          const archives = data.archivedCurricula ?? [];
          const existingIndex = archives.findIndex((archive) =>
            archive.courseId === courseId && archive.fingerprint === fingerprint);
          const archive: ArchivedCurriculum = {
            courseId,
            fingerprint,
            curriculum,
            progress: data.progress,
            processedEventIds: data.processedEventIds,
            notes: data.notes,
          };
          if (existingIndex >= 0) archives[existingIndex] = archive;
          else {
            if (archives.length >= 50) throw new UserDataStoreError('mutation_invalid');
            archives.push(archive);
          }
          data.archivedCurricula = archives;
        }
        const empty = emptyData();
        data.curriculum = null;
        data.curriculumCleared = true;
        data.curriculumRevision = nextCurriculumRevision();
        data.progress = empty.progress;
        data.processedEventIds = [];
        data.notes = [];
        await writeData(file, data);
        return data.curriculumRevision;
      });
    },

    async readProgress(userId: string): Promise<Progress> {
      return (await readData(fileFor(userId))).progress;
    },

    async applyProgress(
      userId: string,
      mutation: ProgressMutation,
      precondition?: CurriculumMutationPrecondition,
    ): Promise<void> {
      const file = fileFor(userId);
      if (!mutation.eventId || mutation.eventId.length > 200) throw new UserDataStoreError('mutation_invalid');
      await enqueue(file, async () => {
        await assertWritableUser(userId);
        const data = await readData(file);
        assertCurriculumPrecondition(data, precondition);
        if (data.curriculumCleared) throw new UserDataStoreError('mutation_invalid');
        if (data.processedEventIds.includes(mutation.eventId)) return;
        if (mutation.status === 'completed' && mutation.lessonId) {
          if (data.curriculum && !curriculumObjectIds(data.curriculum).lessonIds.has(mutation.lessonId)) {
            throw new UserDataStoreError('mutation_invalid');
          }
          if (uniquePush(data.progress.completedLessonIds, mutation.lessonId)) data.progress.weeklyLessons += 1;
        } else if (mutation.status === 'passed' && mutation.exerciseId) {
          if (data.curriculum && !curriculumObjectIds(data.curriculum).exerciseIds.has(mutation.exerciseId)) {
            throw new UserDataStoreError('mutation_invalid');
          }
          uniquePush(data.progress.passedExerciseIds, mutation.exerciseId);
        } else {
          throw new UserDataStoreError('mutation_invalid');
        }
        data.processedEventIds.push(mutation.eventId);
        await writeData(file, data);
      });
    },

    async applyCard(
      userId: string,
      mutation: CardMutation,
      precondition?: CurriculumMutationPrecondition,
    ): Promise<void> {
      const file = fileFor(userId);
      if (!mutation.eventId || mutation.eventId.length > 200 || !mutation.cardId) {
        throw new UserDataStoreError('mutation_invalid');
      }
      await enqueue(file, async () => {
        await assertWritableUser(userId);
        const data = await readData(file);
        assertCurriculumPrecondition(data, precondition);
        if (data.curriculumCleared) throw new UserDataStoreError('mutation_invalid');
        if (data.processedEventIds.includes(mutation.eventId)) return;
        if (data.curriculum && !curriculumObjectIds(data.curriculum).cardIds.has(mutation.cardId)) {
          throw new UserDataStoreError('mutation_invalid');
        }
        if (mutation.result === 'recalled') {
          uniquePush(data.progress.recalledCardIds, mutation.cardId);
          data.progress.weeklyReviews += 1;
        } else if (mutation.result === 'again') {
          data.progress.weeklyReviews += 1;
        } else {
          throw new UserDataStoreError('mutation_invalid');
        }
        data.processedEventIds.push(mutation.eventId);
        await writeData(file, data);
      });
    },

    async saveNote(
      userId: string,
      note: Note,
      precondition?: CurriculumMutationPrecondition,
    ): Promise<void> {
      const file = fileFor(userId);
      if (!note.lessonId || !note.body.trim() || note.body.length > 20_000) {
        throw new UserDataStoreError('mutation_invalid');
      }
      await enqueue(file, async () => {
        await assertWritableUser(userId);
        const data = await readData(file);
        assertCurriculumPrecondition(data, precondition);
        if (data.curriculumCleared) throw new UserDataStoreError('mutation_invalid');
        if (data.curriculum && !curriculumObjectIds(data.curriculum).lessonIds.has(note.lessonId)) {
          throw new UserDataStoreError('mutation_invalid');
        }
        data.notes = data.notes.filter((candidate) => candidate.lessonId !== note.lessonId);
        data.notes.push({ lessonId: note.lessonId, body: note.body });
        await writeData(file, data);
      });
    },

    async readNotes(userId: string): Promise<Note[]> {
      return (await readData(fileFor(userId))).notes;
    },

    async deleteUserData(userId: string): Promise<void> {
      const file = fileFor(userId);
      await enqueue(file, async () => {
        const marker = deletedMarkerFor(userId);
        await mkdir(dirname(marker), { recursive: true, mode: 0o700 });
        await writeFile(marker, `${new Date().toISOString()}\n`, { encoding: 'utf8', mode: 0o600 });
        await rm(dirname(file), { recursive: true, force: true });
      });
    },
  };
}
