import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authAccessTokenKey } from '../lib/secure-store-keys';
import {
  ApiError,
  deleteCurriculum,
  getCurriculum,
  getCurriculumSnapshot,
  mutateProgress,
  replaceCurriculum,
} from './api';
import { demoData } from './demo-data';

const secureStore = vi.hoisted(() => ({ getItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => secureStore);

describe('API de données mobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    secureStore.getItemAsync.mockResolvedValue('opaque-scio-session');
  });

  it('charge le curriculum mobile avec la session SCIO', async () => {
    const revision = `"${'b'.repeat(64)}"`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(demoData.curriculum, { headers: { ETag: revision } }),
    );

    await expect(getCurriculum('https://learning.scio.app/api')).resolves.toEqual(demoData.curriculum);

    expect(secureStore.getItemAsync).toHaveBeenCalledWith(authAccessTokenKey);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/data/curriculum',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer opaque-scio-session' }),
      }),
    );
  });

  it('conserve la révision ETag et la renvoie dans If-Match pour une mutation', async () => {
    const revision = `"${'a'.repeat(64)}"`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(demoData.curriculum, { headers: { ETag: revision } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    await expect(getCurriculumSnapshot('https://learning.scio.app/api')).resolves.toEqual({
      curriculum: demoData.curriculum,
      revision,
    });
    await mutateProgress('https://learning.scio.app/api', {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    }, revision);

    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      method: 'PATCH',
      headers: expect.objectContaining({ 'if-match': revision }),
    });
  });

  it('active un curriculum côté serveur sans envoyer la progression locale', async () => {
    const revision = `"${'d'.repeat(64)}"`;
    const nextRevision = `"${'e'.repeat(64)}"`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204, headers: { ETag: nextRevision } }),
    );

    await expect(replaceCurriculum('https://learning.scio.app/api', demoData, revision))
      .resolves.toBe(nextRevision);

    const [, init] = fetchSpy.mock.calls[0];
    expect(fetchSpy.mock.calls[0][0]).toBe('https://learning.scio.app/api/mobile/data/curriculum');
    expect(init).toMatchObject({
      method: 'PUT',
      headers: expect.objectContaining({ 'if-match': revision }),
    });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      curriculum: demoData.curriculum,
      exercises: demoData.exercises,
      cards: demoData.cards,
    });
    expect(body).not.toHaveProperty('progress');
  });

  it('représente explicitement un compte sans sujet actif', async () => {
    const revision = `"${'f'.repeat(64)}"`;
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204, headers: { ETag: revision } }),
    );

    await expect(getCurriculum('https://learning.scio.app/api')).resolves.toBeNull();
    await expect(getCurriculumSnapshot('https://learning.scio.app/api')).resolves.toEqual({
      curriculum: null,
      revision,
    });
  });

  it('supprime le sujet actif avec la session SCIO', async () => {
    const revision = `"${'1'.repeat(64)}"`;
    const nextRevision = `"${'2'.repeat(64)}"`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(null, { status: 204, headers: { ETag: nextRevision } }),
    );

    await expect(deleteCurriculum('https://learning.scio.app/api', revision)).resolves.toBe(nextRevision);

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/data/curriculum',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'if-match': revision }),
      }),
    );
  });

  it.each([200, 201, 202])('refuse le statut %i pour les contrats PUT et DELETE 204', async (status) => {
    const revision = `"${'3'.repeat(64)}"`;
    const nextRevision = `"${'4'.repeat(64)}"`;
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(null, { status, headers: { ETag: nextRevision } }))
      .mockResolvedValueOnce(new Response(null, { status, headers: { ETag: nextRevision } }));

    await expect(replaceCurriculum('https://learning.scio.app/api', demoData, revision))
      .rejects.toEqual(new ApiError('unexpected', `HTTP_${status}`));
    await expect(deleteCurriculum('https://learning.scio.app/api', revision))
      .rejects.toEqual(new ApiError('unexpected', `HTTP_${status}`));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('distingue la limitation de débit d’une panne serveur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 429 }));

    await expect(getCurriculum('https://learning.scio.app/api')).rejects.toEqual(
      new ApiError('rate_limited'),
    );
  });
});
