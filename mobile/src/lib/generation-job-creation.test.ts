import { describe, expect, it, vi } from 'vitest';

import { startDurableGeneration, type GenerationCreationDependencies } from './generation-job-creation';
import type { GenerationJob } from './generation-job-api';

const job = { id: `job_${'a'.repeat(32)}`, status: 'queued' } as GenerationJob;

function dependencies(): GenerationCreationDependencies {
  return {
    persistCreating: vi.fn(async () => undefined),
    create: vi.fn(async () => job),
    onCreated: vi.fn(),
    persistAttached: vi.fn(async () => undefined),
  };
}

describe('création durable journalisée', () => {
  it('journalise la clé avant le POST puis attache le job', async () => {
    const deps = dependencies();
    const calls: string[] = [];
    vi.mocked(deps.persistCreating).mockImplementation(async () => { calls.push('creating'); });
    vi.mocked(deps.create).mockImplementation(async () => { calls.push('create'); return job; });
    vi.mocked(deps.persistAttached).mockImplementation(async () => { calls.push('attached'); });

    await expect(startDurableGeneration({
      stateToken: 's'.repeat(40),
      requestId: 'generation-1723456789000-1',
      locale: 'fr',
    }, deps)).resolves.toBe(job);
    expect(calls).toEqual(['creating', 'create', 'attached']);
    expect(deps.persistCreating).toHaveBeenCalledWith({
      requestId: 'generation-1723456789000-1',
      locale: 'fr',
    });
  });

  it('n’appelle pas le serveur si le journal local ne peut pas être écrit', async () => {
    const deps = dependencies();
    vi.mocked(deps.persistCreating).mockRejectedValue(new Error('storage'));
    await expect(startDurableGeneration({
      stateToken: 's'.repeat(40),
      requestId: 'generation-1723456789000-1',
      locale: 'fr',
    }, deps)).rejects.toThrow('storage');
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('publie l’identité créée avant de persister le pointeur attaché', async () => {
    const deps = dependencies();
    const calls: string[] = [];
    vi.mocked(deps.onCreated!).mockImplementation(() => { calls.push('created'); });
    vi.mocked(deps.persistAttached).mockImplementation(async () => {
      calls.push('persist-attached');
      throw new Error('storage');
    });
    await expect(startDurableGeneration({
      stateToken: 's'.repeat(40),
      requestId: 'generation-1723456789000-1',
      locale: 'fr',
    }, deps)).rejects.toThrow('storage');
    expect(calls).toEqual(['created', 'persist-attached']);
    expect(deps.onCreated).toHaveBeenCalledWith(job);
  });

  it('conserve le state signé uniquement comme argument du POST, jamais dans le journal', async () => {
    const deps = dependencies();
    await startDurableGeneration({
      stateToken: 'secret-state-token',
      requestId: 'generation-1723456789000-1',
      locale: 'en',
    }, deps);
    expect(deps.persistCreating).toHaveBeenCalledWith({
      requestId: 'generation-1723456789000-1',
      locale: 'en',
    });
    expect(deps.persistAttached).toHaveBeenCalledWith({
      jobId: job.id,
      requestId: 'generation-1723456789000-1',
      locale: 'en',
    });
  });
});
