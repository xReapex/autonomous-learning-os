import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  createScioUserDataStore,
  curriculumFingerprint,
  UserDataStoreError,
} from './scio-user-data-store';

const userA = 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const userB = 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

async function store() {
  return createScioUserDataStore({ dataDirectory: await mkdtemp(join(tmpdir(), 'scio-user-data-')) });
}

function legacyCanonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(legacyCanonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => [key, legacyCanonicalize(entry)]),
    );
  }
  return value;
}

function legacyFingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(legacyCanonicalize(value))).digest('hex');
}

describe('stockage pédagogique SCIO par utilisateur', () => {
  it('isole strictement la progression de deux utilisateurs', async () => {
    const data = await store();

    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });

    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
    expect(await data.readProgress(userB)).toEqual({
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    });
  });

  it('isole le curriculum personnalisé de chaque utilisateur', async () => {
    const data = await store();
    const curriculum = { curriculum: { course: { id: 'custom-a' } }, exercises: [], cards: [] };

    await data.saveCurriculum(userA, curriculum);

    expect(await data.readCurriculum(userA)).toEqual(curriculum);
    expect(await data.readCurriculum(userB)).toBeNull();
  });

  it('relit les fichiers utilisateur antérieurs aux archives sans migration destructive', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-legacy-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
      version: 1,
      progress: {
        completedLessonIds: ['lesson-one'],
        passedExerciseIds: [],
        recalledCardIds: [],
        weeklyLessons: 1,
        weeklyReviews: 0,
      },
      processedEventIds: ['lesson:one:completed'],
      notes: [],
      curriculum: null,
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    const state = await data.readCurriculumState(userA);
    expect(state.status).toBe('default');
    if (state.status !== 'default') throw new Error('default_state_missing');
    expect(state.revision).toMatch(/^[a-f0-9]{64}$/);
    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
  });

  it('persiste une génération opaque pour un nouveau compte avant toute mutation', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-new-revision-'));
    const firstStore = createScioUserDataStore({ dataDirectory: directory });
    const secondStore = createScioUserDataStore({ dataDirectory: directory });

    const first = await firstStore.readCurriculumState(userA);
    const second = await secondStore.readCurriculumState(userA);
    expect(first.status).toBe('default');
    expect(second).toEqual(first);
    if (first.status !== 'default' || !first.revision) throw new Error('default_revision_missing');
    expect(first.revision).toMatch(/^[a-f0-9]{64}$/);

    const persisted = JSON.parse(await readFile(join(directory, 'users', userA, 'data.json'), 'utf8'));
    expect(persisted.curriculumRevision).toBe(first.revision);
  });

  it('dérive une révision vide stable pour un ancien fichier avant sa migration', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-legacy-empty-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      archivedCurricula: [],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    const first = await data.readCurriculumState(userA);
    const second = await data.readCurriculumState(userA);
    expect(first).toEqual(second);
    expect(first).toMatchObject({ status: 'empty' });
    if (first.status !== 'empty') throw new Error('curriculum_state_not_empty');
    expect(first.revision).toMatch(/^[a-f0-9]{64}$/);

    const curriculum = { curriculum: { course: { id: 'new', modules: [] } }, exercises: [], cards: [] };
    const nextRevision = await data.saveCurriculum(userA, curriculum, {
      expectedCurriculumRevision: first.revision,
    });
    expect(nextRevision).toMatch(/^[a-f0-9]{64}$/);
    expect(nextRevision).not.toBe(first.revision);
  });

  it('rejette une archive dont l’identité déclarée ne correspond pas à son contenu', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-invalid-archive-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    const archivedCurriculum = {
      curriculum: { course: { id: 'archive-real', modules: [] } },
      exercises: [],
      cards: [],
    };
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      archivedCurricula: [{
        courseId: 'archive-forged',
        fingerprint: curriculumFingerprint({ forged: true }),
        curriculum: archivedCurriculum,
        progress: {
          completedLessonIds: ['lesson-private'],
          passedExerciseIds: [],
          recalledCardIds: [],
          weeklyLessons: 1,
          weeklyReviews: 0,
        },
        processedEventIds: ['lesson:private'],
        notes: [{ lessonId: 'lesson-private', body: 'Privée' }],
      }],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it('rejette un fichier incohérent marqué vide avec un curriculum encore actif', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-inconsistent-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculum: { curriculum: { course: { id: 'still-active' } } },
      curriculumCleared: true,
      archivedCurricula: [],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
    await expect(data.clearCurriculum(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it('rejette un tombstone vide qui contient encore des données pédagogiques actives', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-invalid-empty-payload-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
      version: 1,
      progress: {
        completedLessonIds: ['lesson-hidden'],
        passedExerciseIds: [],
        recalledCardIds: [],
        weeklyLessons: 1,
        weeklyReviews: 0,
      },
      processedEventIds: ['lesson:hidden'],
      notes: [{ lessonId: 'lesson-hidden', body: 'masquée' }],
      curriculum: null,
      curriculumCleared: true,
      curriculumRevision: 'a'.repeat(64),
      archivedCurricula: [],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it('refuse de vider des données historiques sans curriculum archivable ni fallback', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-orphaned-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
      version: 1,
      progress: {
        completedLessonIds: ['lesson-one'],
        passedExerciseIds: [],
        recalledCardIds: [],
        weeklyLessons: 1,
        weeklyReviews: 0,
      },
      processedEventIds: ['lesson:one:completed'],
      notes: [{ lessonId: 'lesson-one', body: 'À préserver.' }],
      curriculum: null,
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.clearCurriculum(userA)).rejects.toMatchObject({ code: 'mutation_invalid' });
    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: ['lesson-one'] });
    expect(await data.readNotes(userA)).toEqual([{ lessonId: 'lesson-one', body: 'À préserver.' }]);
  });

  it('retire le curriculum actif sans détruire ses données et les restaure au réajout', async () => {
    const data = await store();
    const curriculum = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-one' }] }] } },
      exercises: [{ id: 'exercise-one' }],
      cards: [{ id: 'card-one' }],
    };
    await data.saveCurriculum(userA, curriculum);
    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });
    await data.applyCard(userA, {
      eventId: 'card:one:recalled',
      cardId: 'card-one',
      result: 'recalled',
    });
    await data.saveNote(userA, { lessonId: 'lesson-one', body: 'À retirer.' });

    await data.clearCurriculum(userA, curriculum);

    expect(await data.readCurriculumState(userA)).toMatchObject({ status: 'empty' });
    expect(await data.readProgress(userA)).toEqual({
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    });
    expect(await data.readNotes(userA)).toEqual([]);
    await expect(data.applyProgress(userA, {
      eventId: 'lesson:after-clear',
      lessonId: 'lesson-one',
      status: 'completed',
    })).rejects.toMatchObject({ code: 'mutation_invalid' });

    await data.saveCurriculum(userA, curriculum);

    expect(await data.readProgress(userA)).toEqual({
      completedLessonIds: ['lesson-one'],
      passedExerciseIds: [],
      recalledCardIds: ['card-one'],
      weeklyLessons: 1,
      weeklyReviews: 1,
    });
    expect(await data.readNotes(userA)).toEqual([
      { lessonId: 'lesson-one', body: 'À retirer.' },
    ]);
  });

  it('restaure un curriculum identique malgré un ordre de clés JSON différent', async () => {
    const data = await store();
    const first = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-one' }] }] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, first);
    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });
    await data.clearCurriculum(userA, first);
    const reordered = {
      cards: [],
      exercises: [],
      curriculum: { course: { modules: [{ lessons: [{ id: 'lesson-one' }] }], id: 'cuisine' } },
    };

    await data.saveCurriculum(userA, reordered);

    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
  });

  it('ignore la projection de progression dans l’identité canonique du curriculum', () => {
    const content = {
      curriculum: { course: { id: 'cuisine', modules: [] } },
      exercises: [],
      cards: [],
    };
    expect(curriculumFingerprint({ ...content, progress: { completedLessonIds: ['mutable'] } }))
      .toBe(curriculumFingerprint(content));
  });

  it.each([
    { curriculum: { course: { id: 'missing-exercises' } }, cards: [] },
    { curriculum: { course: { id: 'missing-cards' } }, exercises: [] },
    { exercises: [], cards: [] },
  ])('refuse une mutation durable sans les trois surfaces pédagogiques', async (incomplete) => {
    const data = await store();

    await expect(data.saveCurriculum(userA, incomplete)).rejects.toMatchObject({ code: 'mutation_invalid' });
    await expect(data.clearCurriculum(userA, incomplete)).rejects.toMatchObject({ code: 'mutation_invalid' });
  });

  it.each([
    { curriculum: { course: { id: 'missing-exercises' } }, cards: [] },
    { curriculum: { course: { id: 'missing-cards' } }, exercises: [] },
    { exercises: [], cards: [] },
  ])('refuse un fallback de retrait incomplet même si un curriculum actif existe', async (incomplete) => {
    const data = await store();
    const active = {
      curriculum: { course: { id: 'active', modules: [] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, active);

    await expect(data.clearCurriculum(userA, incomplete)).rejects.toMatchObject({ code: 'mutation_invalid' });
    await expect(data.readCurriculum(userA)).resolves.toEqual(active);

    await data.clearCurriculum(userA, active);
    await expect(data.clearCurriculum(userA, incomplete)).rejects.toMatchObject({ code: 'mutation_invalid' });
    await expect(data.readCurriculumState(userA)).resolves.toMatchObject({ status: 'empty' });
  });

  it('priorise une révision obsolète avant la validation du fallback de retrait', async () => {
    const data = await store();
    const active = {
      curriculum: { course: { id: 'active', modules: [] } },
      exercises: [],
      cards: [],
    };
    const currentRevision = await data.saveCurriculum(userA, active);

    await expect(data.clearCurriculum(userA, { curriculum: active.curriculum }, {
      expectedCurriculumRevision: 'f'.repeat(64),
      fallbackCurriculum: active,
    })).rejects.toMatchObject({ code: 'curriculum_revision_mismatch' });
    await expect(data.readCurriculumState(userA)).resolves.toMatchObject({
      status: 'custom',
      revision: currentRevision,
    });
  });

  it('rejette une archive canonique enrichie par une projection top-level non authentifiée', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-canonical-extra-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    const content = {
      curriculum: { course: { id: 'cuisine', modules: [] } },
      exercises: [],
      cards: [],
    };
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      curriculumRevision: 'a'.repeat(64),
      archivedCurricula: [{
        courseId: 'cuisine',
        fingerprint: curriculumFingerprint(content),
        curriculum: { ...content, progress: { completedLessonIds: ['falsified'] } },
        progress: {
          completedLessonIds: [],
          passedExerciseIds: [],
          recalledCardIds: [],
          weeklyLessons: 0,
          weeklyReviews: 0,
        },
        processedEventIds: [],
        notes: [],
      }],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it.each(['curriculumRevision', 'arbitrary'])('rejette un faux format legacy enrichi par %s même si son hash complet correspond', async (extraKey) => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-invalid-legacy-extra-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    const content = {
      curriculum: { course: { id: 'cuisine', modules: [] } },
      exercises: [],
      cards: [],
      [extraKey]: extraKey === 'curriculumRevision' ? 'b'.repeat(64) : { injected: true },
    };
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      curriculumRevision: 'a'.repeat(64),
      archivedCurricula: [{
        courseId: 'cuisine',
        fingerprint: legacyFingerprint(content),
        curriculum: content,
        progress: {
          completedLessonIds: [],
          passedExerciseIds: [],
          recalledCardIds: [],
          weeklyLessons: 0,
          weeklyReviews: 0,
        },
        processedEventIds: [],
        notes: [],
      }],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it.each([
    {
      completedLessonIds: [42],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    },
    {
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: -1,
      weeklyReviews: 0,
    },
  ])('rejette un progress legacy structurellement invalide même si son hash complet correspond', async (legacyProgress) => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-invalid-legacy-progress-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    const content = {
      curriculum: { course: { id: 'cuisine', modules: [] } },
      exercises: [],
      cards: [],
      progress: legacyProgress,
    };
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      curriculumRevision: 'a'.repeat(64),
      archivedCurricula: [{
        courseId: 'cuisine',
        fingerprint: legacyFingerprint(content),
        curriculum: content,
        progress: {
          completedLessonIds: [],
          passedExerciseIds: [],
          recalledCardIds: [],
          weeklyLessons: 0,
          weeklyReviews: 0,
        },
        processedEventIds: [],
        notes: [],
      }],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await expect(data.readCurriculumState(userA)).rejects.toMatchObject({ code: 'storage_invalid' });
  });

  it('restaure une archive historique dont le hash incluait la projection de progression', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-legacy-archive-'));
    const userDirectory = join(directory, 'users', userA);
    await mkdir(userDirectory, { recursive: true });
    const content = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-one' }] }] } },
      exercises: [],
      cards: [],
    };
    const historicalCurriculum = {
      ...content,
      progress: {
        completedLessonIds: [],
        passedExerciseIds: [],
        recalledCardIds: [],
        weeklyLessons: 0,
        weeklyReviews: 0,
      },
    };
    await writeFile(join(userDirectory, 'data.json'), JSON.stringify({
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
      curriculumCleared: true,
      curriculumRevision: 'a'.repeat(64),
      archivedCurricula: [{
        courseId: 'cuisine',
        fingerprint: legacyFingerprint(historicalCurriculum),
        curriculum: historicalCurriculum,
        progress: {
          completedLessonIds: ['lesson-one'],
          passedExerciseIds: [],
          recalledCardIds: [],
          weeklyLessons: 1,
          weeklyReviews: 0,
        },
        processedEventIds: ['lesson:one:completed'],
        notes: [{ lessonId: 'lesson-one', body: 'Historique.' }],
      }],
    }));
    const data = createScioUserDataStore({ dataDirectory: directory });

    await data.saveCurriculum(userA, content, { expectedCurriculumRevision: 'a'.repeat(64) });

    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
    expect(await data.readNotes(userA)).toEqual([{ lessonId: 'lesson-one', body: 'Historique.' }]);
  });

  it('ne confond pas deux versions sous le même ID et conserve l’archive d’origine', async () => {
    const data = await store();
    const original = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-old' }] }] } },
      exercises: [],
      cards: [{ id: 'card-old' }],
    };
    await data.saveCurriculum(userA, original);
    await data.applyProgress(userA, {
      eventId: 'lesson:old:completed',
      lessonId: 'lesson-old',
      status: 'completed',
    });
    await data.saveNote(userA, { lessonId: 'lesson-old', body: 'Ancienne note.' });
    await data.clearCurriculum(userA, original);

    const changed = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-new' }] }] } },
      exercises: [],
      cards: [{ id: 'card-new' }],
    };
    await data.saveCurriculum(userA, changed);

    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: [] });
    expect(await data.readNotes(userA)).toEqual([]);
    await data.clearCurriculum(userA, changed);
    await data.saveCurriculum(userA, original);
    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-old'],
      weeklyLessons: 1,
    });
    expect(await data.readNotes(userA)).toEqual([
      { lessonId: 'lesson-old', body: 'Ancienne note.' },
    ]);
  });

  it('rejette sous verrou une mutation portant la révision d’un ancien curriculum', async () => {
    const data = await store();
    const original = {
      curriculum: { course: { id: 'shared-course', title: 'Original', modules: [{ lessons: [{ id: 'lesson-shared' }] }] } },
      exercises: [],
      cards: [],
    };
    const replacement = structuredClone(original);
    replacement.curriculum.course.title = 'Replacement';
    await data.saveCurriculum(userA, original);
    const staleRevision = curriculumFingerprint(original);
    await data.saveCurriculum(userA, replacement);

    await expect(data.applyProgress(userA, {
      eventId: 'lesson:stale:completed',
      lessonId: 'lesson-shared',
      status: 'completed',
    }, {
      expectedCurriculumRevision: staleRevision,
      fallbackCurriculum: original,
    })).rejects.toMatchObject({ code: 'curriculum_revision_mismatch' });
    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: [] });
  });

  it('rejette sous verrou une mutation préparée avant le retrait du curriculum', async () => {
    const data = await store();
    const curriculum = {
      curriculum: { course: { id: 'shared', modules: [{ lessons: [{ id: 'lesson-shared' }] }] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, curriculum);
    const state = await data.readCurriculumState(userA);
    if (state.status !== 'custom') throw new Error('curriculum_state_not_custom');

    await data.clearCurriculum(userA, curriculum, {
      expectedCurriculumRevision: state.revision,
      fallbackCurriculum: curriculum,
    });
    await expect(data.applyProgress(userA, {
      eventId: 'lesson:late-after-delete',
      lessonId: 'lesson-shared',
      status: 'completed',
    }, {
      expectedCurriculumRevision: state.revision,
      fallbackCurriculum: curriculum,
    })).rejects.toMatchObject({ code: 'curriculum_revision_mismatch' });
    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: [] });
  });

  it('rejette sous verrou une activation retardée après le retrait du curriculum', async () => {
    const data = await store();
    const original = {
      curriculum: { course: { id: 'shared', modules: [{ lessons: [{ id: 'lesson-shared' }] }] } },
      exercises: [],
      cards: [],
    };
    const replacement = structuredClone(original);
    (replacement.curriculum as Record<string, unknown>).revisionProbe = 'replacement';
    await data.saveCurriculum(userA, original);
    const state = await data.readCurriculumState(userA);
    expect(state).toMatchObject({ status: 'custom' });
    if (state.status !== 'custom') throw new Error('curriculum_state_not_custom');
    const staleRevision = state.revision;
    expect(staleRevision).toMatch(/^[a-f0-9]{64}$/);

    await data.clearCurriculum(userA, original, {
      expectedCurriculumRevision: staleRevision,
      fallbackCurriculum: original,
    });
    await expect(data.saveCurriculum(userA, replacement, {
      expectedCurriculumRevision: staleRevision,
      fallbackCurriculum: original,
    })).rejects.toMatchObject({ code: 'curriculum_revision_mismatch' });
    expect(await data.readCurriculumState(userA)).toMatchObject({ status: 'empty' });
  });

  it('refuse de retirer un curriculum non archivable plutôt que détruire ses données', async () => {
    const data = await store();
    const invalidIdentity = {
      curriculum: { course: { modules: [{ lessons: [{ id: 'lesson-one' }] }] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, invalidIdentity);
    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });

    await expect(data.clearCurriculum(userA, invalidIdentity)).rejects.toMatchObject({
      code: 'mutation_invalid',
    });
    expect(await data.readCurriculum(userA)).toEqual(invalidIdentity);
    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: ['lesson-one'] });
  });

  it('refuse une archive au-delà de la limite sans perdre le curriculum actif', async () => {
    const data = await store();
    for (let index = 0; index < 50; index += 1) {
      const curriculum = {
        curriculum: { course: { id: `course-${index}`, modules: [] } },
        exercises: [],
        cards: [],
      };
      await data.saveCurriculum(userA, curriculum);
      await data.clearCurriculum(userA, curriculum);
    }
    const active = {
      curriculum: { course: { id: 'course-over-limit', modules: [{ lessons: [{ id: 'lesson-active' }] }] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, active);
    await data.applyProgress(userA, {
      eventId: 'lesson:active:completed',
      lessonId: 'lesson-active',
      status: 'completed',
    });

    await expect(data.clearCurriculum(userA, active)).rejects.toMatchObject({
      code: 'mutation_invalid',
    });
    expect(await data.readCurriculum(userA)).toEqual(active);
    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: ['lesson-active'] });
  });

  it('préserve l’archive lors de deux retraits concurrents du même curriculum', async () => {
    const data = await store();
    const curriculum = {
      curriculum: { course: { id: 'cuisine', modules: [{ lessons: [{ id: 'lesson-one' }] }] } },
      exercises: [],
      cards: [],
    };
    await data.saveCurriculum(userA, curriculum);
    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });

    await Promise.all([
      data.clearCurriculum(userA, curriculum),
      data.clearCurriculum(userA, curriculum),
    ]);
    await data.saveCurriculum(userA, curriculum);

    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
  });

  it('rend les événements idempotents pour un même utilisateur', async () => {
    const data = await store();
    const mutation = {
      eventId: 'exercise:one:passed',
      exerciseId: 'exercise-one',
      status: 'passed' as const,
    };

    await data.applyProgress(userA, mutation);
    await data.applyProgress(userA, mutation);

    expect(await data.readProgress(userA)).toMatchObject({
      passedExerciseIds: ['exercise-one'],
      weeklyLessons: 0,
    });
  });

  it('partitionne les rappels de cartes et les notes', async () => {
    const data = await store();
    await data.applyCard(userA, {
      eventId: 'card:one:recalled',
      cardId: 'card-one',
      result: 'recalled',
    });
    await data.saveNote(userA, { lessonId: 'lesson-one', body: 'Une note privée.' });

    expect((await data.readProgress(userA)).recalledCardIds).toEqual(['card-one']);
    expect((await data.readProgress(userB)).recalledCardIds).toEqual([]);
    expect(await data.readNotes(userA)).toEqual([{ lessonId: 'lesson-one', body: 'Une note privée.' }]);
    expect(await data.readNotes(userB)).toEqual([]);
  });

  it('compte une nouvelle révision de la même carte sans dupliquer son identifiant', async () => {
    const data = await store();
    await data.applyCard(userA, {
      eventId: 'card:one:first',
      cardId: 'card-one',
      result: 'recalled',
    });
    await data.applyCard(userA, {
      eventId: 'card:one:second',
      cardId: 'card-one',
      result: 'recalled',
    });

    expect(await data.readProgress(userA)).toMatchObject({
      recalledCardIds: ['card-one'],
      weeklyReviews: 2,
    });
  });

  it('supprime physiquement toutes les données personnelles de l’utilisateur', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-user-data-delete-'));
    const data = createScioUserDataStore({ dataDirectory: directory });
    await data.applyProgress(userA, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });

    await data.deleteUserData(userA);

    expect(await data.readProgress(userA)).toMatchObject({ completedLessonIds: [] });
    await expect(readFile(join(directory, 'users', userA, 'data.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(data.applyProgress(userA, {
      eventId: 'lesson:after-delete',
      lessonId: 'lesson-one',
      status: 'completed',
    })).rejects.toMatchObject({ code: 'user_deleted' });
  });

  it('refuse une mutation devenue obsolète après remplacement du curriculum', async () => {
    const data = await store();
    await data.saveCurriculum(userA, {
      curriculum: { course: { modules: [{ lessons: [{ id: 'lesson-new' }] }] } },
      exercises: [{ id: 'exercise-new' }],
      cards: [{ id: 'card-new' }],
    });

    await expect(data.applyProgress(userA, {
      eventId: 'lesson:removed:completed',
      lessonId: 'lesson-removed',
      status: 'completed',
    })).rejects.toMatchObject({ code: 'mutation_invalid' });
    await expect(data.applyCard(userA, {
      eventId: 'card:removed:recalled',
      cardId: 'card-removed',
      result: 'recalled',
    })).rejects.toMatchObject({ code: 'mutation_invalid' });
    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    });
  });

  it('rejette un identifiant utilisateur hors contrat', async () => {
    const data = await store();
    await expect(data.readProgress('../shared')).rejects.toBeInstanceOf(UserDataStoreError);
  });
});
