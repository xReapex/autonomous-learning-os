import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authAccessTokenKey } from './secure-store-keys';
import { createGenerationJob, getGenerationJob, resolveGenerationJob } from './generation-job-api';

const secureStore = vi.hoisted(() => ({ getItemAsync: vi.fn() }));
vi.mock('expo-secure-store', () => secureStore);

const queuedJob = {
  id: `job_${'a'.repeat(32)}`,
  status: 'queued',
  attempts: 0,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  output: null,
  error: null,
};

describe('API mobile de génération durable', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.EXPO_PUBLIC_ENGINE_URL = 'https://learning.scio.app/api/mobile';
    secureStore.getItemAsync.mockResolvedValue(`scio_${'t'.repeat(48)}`);
  });

  it('crée un job idempotent sans stocker le state côté client', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ job: queuedJob }, { status: 202 }));
    await expect(createGenerationJob('s'.repeat(40), 'generation-1234567890123456')).resolves.toEqual(queuedJob);
    expect(secureStore.getItemAsync).toHaveBeenCalledWith(authAccessTokenKey);
    expect(fetchSpy).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/curriculum/jobs',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: expect.stringMatching(/^Bea.{3} scio_/),
          'Idempotency-Key': 'generation-1234567890123456',
        }),
        body: JSON.stringify({ state: 's'.repeat(40), action: 'confirm' }),
      }),
    );
  });

  it('relit uniquement un job borné appartenant à la session', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ job: { ...queuedJob, status: 'running', attempts: 1 } }));
    await expect(getGenerationJob(queuedJob.id)).resolves.toMatchObject({ status: 'running', attempts: 1 });
    expect(fetchSpy.mock.calls[0][0]).toBe(`https://learning.scio.app/api/mobile/curriculum/jobs/${queuedJob.id}`);
  });

  it('résout un POST dont la réponse a été perdue avec la même clé idempotente', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ job: queuedJob }));
    await expect(resolveGenerationJob('generation-1234567890123456')).resolves.toEqual(queuedJob);
    expect(fetchSpy.mock.calls[0][0]).toBe(
      'https://learning.scio.app/api/mobile/curriculum/jobs?requestId=generation-1234567890123456',
    );
  });

  it('marque comme expiré un journal de création sans job serveur récupérable', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'job_not_found' }, { status: 404 }));
    await expect(resolveGenerationJob('generation-1234567890123456')).rejects.toMatchObject({ code: 'expired' });
  });

  it('rejette une sortie qui fuit le payload ou possède un schéma invalide', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ job: { ...queuedJob, payload: { state: 'secret' } } }));
    await expect(getGenerationJob(queuedJob.id)).rejects.toMatchObject({ code: 'invalid' });
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'busy'],
    [500, 'network'],
  ] as const)('traduit HTTP %s en %s', async (status, code) => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(Response.json({ error: 'x' }, { status }));
    await expect(getGenerationJob(queuedJob.id)).rejects.toMatchObject({ code });
  });
});
