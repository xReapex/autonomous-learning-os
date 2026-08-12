import { describe, expect, it, vi } from 'vitest';

import { createMutationLock } from './mutation-lock';

describe('createMutationLock', () => {
  it('refuses a concurrent mutation and unlocks after settlement', async () => {
    let release!: () => void;
    const task = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const lock = createMutationLock();

    const first = lock.run(task);
    await expect(lock.run(task)).resolves.toEqual({ started: false });
    expect(task).toHaveBeenCalledTimes(1);

    release();
    await expect(first).resolves.toEqual({ started: true, value: undefined });
    await expect(lock.run(async () => 'done')).resolves.toEqual({ started: true, value: 'done' });
  });
});
