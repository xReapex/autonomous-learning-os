import { mkdtemp, readFile } from 'node:fs/promises';
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
