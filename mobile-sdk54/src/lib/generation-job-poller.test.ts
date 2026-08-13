import { describe, expect, it, vi } from 'vitest';

import { pollGenerationJob } from './generation-job-poller';

const queued = { id: 'job', status: 'queued' as const };
const running = { id: 'job', status: 'running' as const };
const succeeded = { id: 'job', status: 'succeeded' as const, output: { phase: 'proposal' } };

describe('polling de job durable', () => {
  it('attend jusqu’à un état terminal avec backoff borné', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(succeeded);
    const delays: number[] = [];
    await expect(pollGenerationJob('job', {
      get,
      wait: async (ms: number) => { delays.push(ms); },
      isCancelled: () => false,
    })).resolves.toBe(succeeded);
    expect(delays).toEqual([1000, 1500]);
  });

  it('publie chaque jalon observé avant l’état terminal', async () => {
    const get = vi.fn()
      .mockResolvedValueOnce(queued)
      .mockResolvedValueOnce(running)
      .mockResolvedValueOnce(succeeded);
    const observed: string[] = [];
    await expect(pollGenerationJob('job', {
      get,
      wait: async () => undefined,
      isCancelled: () => false,
      onUpdate: (job) => observed.push(job.status),
    })).resolves.toBe(succeeded);
    expect(observed).toEqual(['queued', 'running', 'succeeded']);
  });

  it('rejette une réponse portant l’identité d’un autre job', async () => {
    const observed = vi.fn();
    await expect(pollGenerationJob('job', {
      get: vi.fn().mockResolvedValue({ ...running, id: 'other-job' }),
      wait: async () => undefined,
      isCancelled: () => false,
      onUpdate: observed,
    })).rejects.toMatchObject({ code: 'invalid' });
    expect(observed).not.toHaveBeenCalled();
  });

  it('interrompt sans nouvelle lecture lorsque le provider est démonté', async () => {
    const get = vi.fn().mockResolvedValue(queued);
    let cancelled = false;
    await expect(pollGenerationJob('job', {
      get,
      wait: async () => { cancelled = true; },
      isCancelled: () => cancelled,
    })).resolves.toBeNull();
    expect(get).toHaveBeenCalledTimes(1);
  });
});
