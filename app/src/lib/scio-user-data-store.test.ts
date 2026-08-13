import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { createScioUserDataStore, UserDataStoreError } from './scio-user-data-store';

const userA = 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const userB = 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';

async function store() {
  return createScioUserDataStore({ dataDirectory: await mkdtemp(join(tmpdir(), 'scio-user-data-')) });
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

    expect(await data.readCurriculumState(userA)).toEqual({ status: 'default' });
    expect(await data.readProgress(userA)).toMatchObject({
      completedLessonIds: ['lesson-one'],
      weeklyLessons: 1,
    });
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

    expect(await data.readCurriculumState(userA)).toEqual({ status: 'empty' });
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
