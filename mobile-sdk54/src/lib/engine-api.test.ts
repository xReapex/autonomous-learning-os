import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { authAccessTokenKey } from './secure-store-keys';
import { beginEngineInterview, sendEngineInterview } from './engine-api';

const secureStore = vi.hoisted(() => ({
  deleteItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  setItemAsync: vi.fn(),
}));
vi.mock('expo-secure-store', () => secureStore);

describe('entretien moteur avec session SCIO', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.EXPO_PUBLIC_ENGINE_URL = 'https://learning.scio.app/api/mobile';
    secureStore.getItemAsync.mockResolvedValue('scio_' + 't'.repeat(48));
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_ENGINE_URL;
  });

  it('utilise le jeton SCIO opaque, sans échange technique', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({
      phase: 'question',
      message: 'Quel sujet veux-tu apprendre ?',
      choices: ['Une langue', 'Une compétence', 'Un sujet théorique'],
      progress: 10,
      document: null,
      state: 's'.repeat(40),
    }));

    await expect(sendEngineInterview({ locale: 'fr' })).resolves.toMatchObject({ phase: 'question' });

    expect(secureStore.getItemAsync).toHaveBeenCalledWith(authAccessTokenKey);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/curriculum/interview',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: `Bearer ${'scio_' + 't'.repeat(48)}` }),
      }),
    );
    expect(secureStore.setItemAsync).not.toHaveBeenCalled();
  });

  it('transmet le sujet saisi comme première réponse réelle de l’entretien', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json({
        phase: 'question',
        message: 'Quel sujet précis veux-tu apprendre ?',
        choices: ['Une langue', 'Une compétence', 'Un sujet théorique'],
        progress: 10,
        document: null,
        state: 'a'.repeat(40),
      }))
      .mockResolvedValueOnce(Response.json({
        phase: 'question',
        message: 'Comment apprends-tu actuellement ce sujet ?',
        choices: ['Avec des vidéos', 'En pratiquant', 'Avec des cours'],
        progress: 20,
        document: null,
        state: 'b'.repeat(40),
      }));

    await expect(beginEngineInterview('fr', 'Architecture logicielle')).resolves.toMatchObject({
      phase: 'question',
      progress: 20,
    });

    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toEqual({ locale: 'fr' });
    expect(JSON.parse(String(fetchSpy.mock.calls[1][1]?.body))).toEqual({
      state: 'a'.repeat(40),
      answer: 'Architecture logicielle',
    });
  });

  it('distingue un état signé expiré d’une panne réseau récupérable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json(
      { error: 'interview_state_expired' },
      { status: 410 },
    ));

    await expect(sendEngineInterview({
      state: 's'.repeat(40),
      action: 'confirm',
    })).rejects.toMatchObject({ code: 'expired' });
  });
});
