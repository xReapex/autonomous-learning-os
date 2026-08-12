import { describe, expect, it, vi } from 'vitest';

import { pollGenerationJob } from './generation-job-poller';

const queued = { status: 'queued' as const };
const running = { status: 'running' as const };
const succeeded = { status: 'succeeded' as const, output: { phase: 'proposal' } };

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
