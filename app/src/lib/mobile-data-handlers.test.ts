import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { createMobileDataHandlers } from './mobile-data-handlers';
import { loadMobileDefaultData } from './mobile-default-data';
import { createScioUserDataStore } from './scio-user-data-store';

const userA = { id: 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', displayName: 'A', provider: 'development' as const };
const userB = { id: 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', displayName: 'B', provider: 'development' as const };
let defaultData: Awaited<ReturnType<typeof loadMobileDefaultData>>;
const initialRevisions = new Map<string, string>();

function request(path: string, token?: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', String.fromCharCode(66, 101, 97, 114, 101, 114, 32) + token);
  if ((init.body || init.method === 'DELETE') && /^(curriculum|progress|cards\/|notes)/.test(path) && !headers.has('If-Match')) {
    const revision = token ? initialRevisions.get(token) : undefined;
    if (revision) headers.set('If-Match', revision);
  }
  return new Request(`https://learning.scio.app/api/mobile/data/${path}`, {
    ...init,
    headers,
  });
}

describe('handlers de données mobile SCIO', () => {
  let handlers: ReturnType<typeof createMobileDataHandlers>;

  beforeEach(async () => {
    initialRevisions.clear();
    defaultData = await loadMobileDefaultData();
    const users = createScioUserDataStore({
      dataDirectory: await mkdtemp(join(tmpdir(), 'scio-mobile-handlers-')),
    });
    handlers = createMobileDataHandlers({
      auth: {
        verifySession: async (token: string) => {
          if (token === 'token-a'.repeat(6)) return { user: userA, entitlement: 'demo', expiresAt: '2099-01-01T00:00:00.000Z' };
          if (token === 'token-b'.repeat(6)) return { user: userB, entitlement: 'demo', expiresAt: '2099-01-01T00:00:00.000Z' };
          return null;
        },
      },
      users,
      loadDefaultData: async () => defaultData,
    });
    for (const token of ['token-a'.repeat(6), 'token-b'.repeat(6)]) {
      const response = await handlers.getCurriculum(request('curriculum', token));
      const revision = response.headers.get('etag');
      if (!revision) throw new Error('test_revision_missing');
      initialRevisions.set(token, revision);
    }
  });

  it('refuse une lecture sans session SCIO', async () => {
    const response = await handlers.getCurriculum(request('curriculum'));
    expect(response.status).toBe(401);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('sert curriculum et cartes à une session valide', async () => {
    const token = 'token-a'.repeat(6);
    const curriculum = await handlers.getCurriculum(request('curriculum', token));
    const cards = await handlers.getCards(request('cards', token));

    expect(curriculum.status).toBe(200);
    expect(curriculum.headers.get('etag')).toBe(initialRevisions.get(token));
    expect((await curriculum.json()).course.id).toBe('clear-thinking');
    expect(await cards.json()).toEqual({ cards: defaultData.cards, exercises: defaultData.exercises });
  });

  it('partitionne progression et mutations par user_id dérivé du Bearer', async () => {
    const tokenA = 'token-a'.repeat(6);
    const tokenB = 'token-b'.repeat(6);
    const mutation = JSON.stringify({
      eventId: 'lesson:one:completed',
      lessonId: 'recognize-bias',
      status: 'completed',
    });

    expect((await handlers.patchProgress(request('progress', tokenA, { method: 'PATCH', body: mutation }))).status).toBe(204);
    const progressA = await (await handlers.getProgress(request('progress', tokenA))).json();
    const progressB = await (await handlers.getProgress(request('progress', tokenB))).json();

    expect(progressA.completedLessonIds).toEqual(['recognize-bias']);
    expect(progressB.completedLessonIds).toEqual([]);
  });

  it('rejette une mutation retardée d’une ancienne version même si les IDs sont réutilisés', async () => {
    const token = 'token-a'.repeat(6);
    const oldRevision = initialRevisions.get(token)!;
    const replacement = structuredClone(defaultData);
    replacement.curriculum.revisionProbe = 'replacement-version';
    expect((await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT',
      body: JSON.stringify(replacement),
    }))).status).toBe(204);

    const response = await handlers.patchProgress(request('progress', token, {
      method: 'PATCH',
      headers: { 'If-Match': oldRevision },
      body: JSON.stringify({
        eventId: 'lesson:stale:completed',
        lessonId: replacement.curriculum.course.modules[0].lessons[0].id,
        status: 'completed',
      }),
    }));

    expect(response.status).toBe(412);
  });

  it('rejette une activation retardée qui arrive après le retrait du curriculum', async () => {
    const token = 'token-a'.repeat(6);
    const initial = await handlers.getCurriculum(request('curriculum', token));
    const staleRevision = initial.headers.get('etag');
    expect(staleRevision).toMatch(/^"[a-f0-9]{64}"$/);

    const removed = await handlers.deleteCurriculum(request('curriculum', token, {
      method: 'DELETE',
      headers: { 'If-Match': staleRevision! },
    }));
    expect(removed.status).toBe(204);
    const emptyRevision = removed.headers.get('etag');
    expect(emptyRevision).toMatch(/^"[a-f0-9]{64}"$/);
    expect(emptyRevision).not.toBe(staleRevision);

    const replacement = structuredClone(defaultData);
    replacement.curriculum.revisionProbe = 'late-put';
    const late = await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT',
      headers: { 'If-Match': staleRevision! },
      body: JSON.stringify(replacement),
    }));

    expect(late.status).toBe(412);
    const empty = await handlers.getCurriculum(request('curriculum', token));
    expect(empty.status).toBe(204);
    expect(empty.headers.get('etag')).toBe(emptyRevision);
  });

  it('exige une précondition de curriculum pour toute écriture', async () => {
    const token = 'token-a'.repeat(6);
    const progress = await handlers.patchProgress(request('progress', token, {
      method: 'PATCH',
      headers: { 'If-Match': '' },
      body: '{invalid-json',
    }));
    const activation = await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT',
      headers: { 'If-Match': '' },
      body: '{invalid-json',
    }));
    const card = await handlers.patchCard(request('cards/missing', token, {
      method: 'PATCH',
      headers: { 'If-Match': '' },
      body: '{invalid-json',
    }), 'missing');
    const note = await handlers.postNote(request('notes', token, {
      method: 'POST',
      headers: { 'If-Match': '' },
      body: '{invalid-json',
    }));
    const removal = await handlers.deleteCurriculum(request('curriculum', token, {
      method: 'DELETE',
      headers: { 'If-Match': '' },
    }));

    expect(progress.status).toBe(428);
    expect(activation.status).toBe(428);
    expect(card.status).toBe(428);
    expect(note.status).toBe(428);
    expect(removal.status).toBe(428);
  });

  it('rejette un ETag périmé avant le corps ou la recherche d’objet', async () => {
    const token = 'token-a'.repeat(6);
    const staleRevision = initialRevisions.get(token)!;
    const replacement = structuredClone(defaultData);
    replacement.curriculum.revisionProbe = 'fresh-before-invalid-body';
    const replaced = await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT',
      headers: { 'If-Match': staleRevision },
      body: JSON.stringify(replacement),
    }));
    expect(replaced.status).toBe(204);

    const invalidBody = '{invalid-json';
    const progress = await handlers.patchProgress(request('progress', token, {
      method: 'PATCH', headers: { 'If-Match': staleRevision }, body: invalidBody,
    }));
    const activation = await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT', headers: { 'If-Match': staleRevision }, body: invalidBody,
    }));
    const card = await handlers.patchCard(request('cards/missing', token, {
      method: 'PATCH', headers: { 'If-Match': staleRevision }, body: invalidBody,
    }), 'missing');
    const note = await handlers.postNote(request('notes', token, {
      method: 'POST', headers: { 'If-Match': staleRevision }, body: invalidBody,
    }));

    expect(progress.status).toBe(412);
    expect(activation.status).toBe(412);
    expect(card.status).toBe(412);
    expect(note.status).toBe(412);
  });

  it('rejette une mutation qui cible un objet hors curriculum', async () => {
    const response = await handlers.patchCard(request('cards/unknown', 'token-a'.repeat(6), {
      method: 'PATCH',
      body: JSON.stringify({ eventId: 'card:unknown', cardId: 'unknown', result: 'recalled' }),
    }), 'unknown');
    expect(response.status).toBe(404);
  });

  it('enregistre une note uniquement pour son propriétaire', async () => {
    const response = await handlers.postNote(request('notes', 'token-a'.repeat(6), {
      method: 'POST',
      body: JSON.stringify({ lessonId: 'recognize-bias', body: 'Note privée' }),
    }));
    expect(response.status).toBe(204);
  });

  it('stocke et relit un curriculum personnalisé uniquement pour son propriétaire', async () => {
    const custom = structuredClone(defaultData);
    custom.curriculum.course.id = 'custom-course-a';
    const tokenA = 'token-a'.repeat(6);
    const tokenB = 'token-b'.repeat(6);

    const saved = await handlers.putCurriculum(request('curriculum', tokenA, {
      method: 'PUT',
      body: JSON.stringify(custom),
    }));
    expect(saved.status).toBe(204);

    const curriculumA = await (await handlers.getCurriculum(request('curriculum', tokenA))).json();
    const curriculumB = await (await handlers.getCurriculum(request('curriculum', tokenB))).json();
    expect(curriculumA.course.id).toBe('custom-course-a');
    expect(curriculumB.course.id).toBe('clear-thinking');
  });

  it('réconcilie durablement la progression lors du remplacement du curriculum', async () => {
    const token = 'token-a'.repeat(6);
    const completed = JSON.stringify({
      eventId: 'lesson:old:completed',
      lessonId: 'recognize-bias',
      status: 'completed',
    });
    expect((await handlers.patchProgress(request('progress', token, { method: 'PATCH', body: completed }))).status).toBe(204);

    const replacement = structuredClone(defaultData);
    replacement.curriculum.course.modules = replacement.curriculum.course.modules.map((module) => ({
      ...module,
      lessons: module.lessons.filter((lesson) => lesson.id !== 'recognize-bias'),
    }));
    const saved = await handlers.putCurriculum(request('curriculum', token, {
      method: 'PUT',
      body: JSON.stringify(replacement),
    }));
    expect(saved.status).toBe(204);

    const progress = await (await handlers.getProgress(request('progress', token))).json();
    expect(progress.completedLessonIds).toEqual([]);
  });

  it('retire uniquement le sujet actif, conserve son historique et sert ensuite un état vide', async () => {
    const tokenA = 'token-a'.repeat(6);
    const tokenB = 'token-b'.repeat(6);
    const custom = structuredClone(defaultData);
    custom.curriculum.course.id = 'cuisine';
    expect((await handlers.putCurriculum(request('curriculum', tokenA, {
      method: 'PUT',
      body: JSON.stringify(custom),
    }))).status).toBe(204);
    const customRevision = (await handlers.getCurriculum(request('curriculum', tokenA))).headers.get('etag');
    expect(customRevision).toMatch(/^"[a-f0-9]{64}"$/);
    expect((await handlers.patchProgress(request('progress', tokenA, {
      method: 'PATCH',
      headers: { 'If-Match': customRevision! },
      body: JSON.stringify({
        eventId: 'lesson:cuisine:completed',
        lessonId: custom.curriculum.course.modules[0].lessons[0].id,
        status: 'completed',
      }),
    }))).status).toBe(204);

    const removed = await handlers.deleteCurriculum(request('curriculum', tokenA, {
      method: 'DELETE',
      headers: { 'If-Match': customRevision! },
    }));

    expect(removed.status).toBe(204);
    const emptyRevision = removed.headers.get('etag');
    expect(emptyRevision).toMatch(/^"[a-f0-9]{64}"$/);
    const empty = await handlers.getCurriculum(request('curriculum', tokenA));
    expect(empty.status).toBe(204);
    expect(empty.headers.get('etag')).toBe(emptyRevision);
    const secondRemoval = await handlers.deleteCurriculum(request('curriculum', tokenA, {
      method: 'DELETE',
      headers: { 'If-Match': emptyRevision! },
    }));
    expect(secondRemoval.status).toBe(204);
    expect(secondRemoval.headers.get('etag')).toBe(emptyRevision);
    const staleSecondRemoval = await handlers.deleteCurriculum(request('curriculum', tokenA, {
      method: 'DELETE',
      headers: { 'If-Match': customRevision! },
    }));
    expect(staleSecondRemoval.status).toBe(412);
    expect(await (await handlers.getCards(request('cards', tokenA))).json()).toEqual({ cards: [], exercises: [] });
    expect(await (await handlers.getProgress(request('progress', tokenA))).json()).toEqual({
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    });
    expect((await handlers.getCurriculum(request('curriculum', tokenB))).status).toBe(200);

    expect((await handlers.putCurriculum(request('curriculum', tokenA, {
      method: 'PUT',
      headers: { 'If-Match': emptyRevision! },
      body: JSON.stringify(custom),
    }))).status).toBe(204);
    const staleDelete = await handlers.deleteCurriculum(request('curriculum', tokenA, {
      method: 'DELETE',
      headers: { 'If-Match': emptyRevision! },
    }));
    expect(staleDelete.status).toBe(412);
    expect((await handlers.getCurriculum(request('curriculum', tokenA))).status).toBe(200);
    expect(await (await handlers.getProgress(request('progress', tokenA))).json()).toMatchObject({
      completedLessonIds: [custom.curriculum.course.modules[0].lessons[0].id],
      weeklyLessons: 1,
    });
  });
});
