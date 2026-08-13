import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authAccessTokenKey } from '../lib/secure-store-keys';
import { ApiError, deleteCurriculum, getCurriculum, replaceCurriculum } from './api';
import { demoData } from './demo-data';

const secureStore = vi.hoisted(() => ({ getItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => secureStore);

describe('API de données mobile', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    secureStore.getItemAsync.mockResolvedValue('opaque-scio-session');
  });

  it('charge le curriculum mobile avec la session SCIO', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      Response.json(demoData.curriculum),
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

  it('active un curriculum côté serveur sans envoyer la progression locale', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await replaceCurriculum('https://learning.scio.app/api', demoData);

    const [, init] = fetchSpy.mock.calls[0];
    expect(fetchSpy.mock.calls[0][0]).toBe('https://learning.scio.app/api/mobile/data/curriculum');
    expect(init).toMatchObject({ method: 'PUT' });
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      curriculum: demoData.curriculum,
      exercises: demoData.exercises,
      cards: demoData.cards,
    });
    expect(body).not.toHaveProperty('progress');
  });

  it('représente explicitement un compte sans sujet actif', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await expect(getCurriculum('https://learning.scio.app/api')).resolves.toBeNull();
  });

  it('supprime le sujet actif avec la session SCIO', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    await deleteCurriculum('https://learning.scio.app/api');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/data/curriculum',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('distingue la limitation de débit d’une panne serveur', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 429 }));

    await expect(getCurriculum('https://learning.scio.app/api')).rejects.toEqual(
      new ApiError('rate_limited'),
    );
  });
});
