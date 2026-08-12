import { describe, expect, it, vi } from 'vitest';

import { finalizeGenerationJob, type GenerationJobLifecycleDependencies } from './generation-job-lifecycle';
import type { GenerationJob } from './generation-job-api';

const active = { id: `job_${'a'.repeat(32)}`, status: 'running' } as GenerationJob;
const terminal = { ...active, status: 'succeeded' } as GenerationJob;

function dependencies(): GenerationJobLifecycleDependencies {
  return {
    cancel: vi.fn(async () => ({ ...active, status: 'cancelled' } as GenerationJob)),
    acknowledge: vi.fn(async () => undefined),
    removeLocal: vi.fn(async () => undefined),
  };
}

describe('fin de vie d’un job durable', () => {
  it('annule un job actif, l’acquitte, puis seulement efface son journal local', async () => {
    const deps = dependencies();
    const calls: string[] = [];
    vi.mocked(deps.cancel).mockImplementation(async () => { calls.push('cancel'); return { ...active, status: 'cancelled' }; });
    vi.mocked(deps.acknowledge).mockImplementation(async () => { calls.push('ack'); });
    vi.mocked(deps.removeLocal).mockImplementation(async () => { calls.push('remove'); });

    await finalizeGenerationJob(active, deps);

    expect(calls).toEqual(['cancel', 'ack', 'remove']);
  });

  it('acquitte directement un job terminal avant d’effacer son journal', async () => {
    const deps = dependencies();
    await finalizeGenerationJob(terminal, deps);
    expect(deps.cancel).not.toHaveBeenCalled();
    expect(deps.acknowledge).toHaveBeenCalledWith(terminal.id);
    expect(deps.removeLocal).toHaveBeenCalledTimes(1);
  });

  it('conserve le journal si annulation ou acquittement échoue', async () => {
    const cancelFailure = dependencies();
    vi.mocked(cancelFailure.cancel).mockRejectedValue(new Error('network'));
    await expect(finalizeGenerationJob(active, cancelFailure)).rejects.toThrow('network');
    expect(cancelFailure.removeLocal).not.toHaveBeenCalled();

    const acknowledgeFailure = dependencies();
    vi.mocked(acknowledgeFailure.acknowledge).mockRejectedValue(new Error('network'));
    await expect(finalizeGenerationJob(terminal, acknowledgeFailure)).rejects.toThrow('network');
    expect(acknowledgeFailure.removeLocal).not.toHaveBeenCalled();
  });
});
