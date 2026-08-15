import { describe, expect, it, vi } from 'vitest';

import {
  createExpiredSessionCleanupCoordinator,
  observeExpiredSessionCleanup,
} from './expired-session-cleanup';

describe('coordinateur de purge de session expirée', () => {
  it('reste single-flight et rejoue la purge si une expiration arrive pendant son exécution', async () => {
    const coordinator = createExpiredSessionCleanupCoordinator();
    let releaseFirst: () => void = () => {};
    const first = new Promise<void>((resolve) => { releaseFirst = resolve; });
    const cleanup = vi.fn()
      .mockImplementationOnce(() => first)
      .mockResolvedValueOnce(undefined);

    coordinator.require();
    const running = coordinator.ensure(cleanup);
    expect(coordinator.ensure(cleanup)).toBe(running);
    coordinator.require();
    releaseFirst();

    await expect(running).resolves.toBe('cleared');
    expect(cleanup).toHaveBeenCalledTimes(2);
    expect(coordinator.isRequired()).toBe(false);
  });

  it('reste requis après un échec et réussit au Retry', async () => {
    const coordinator = createExpiredSessionCleanupCoordinator();
    coordinator.require();

    await expect(coordinator.ensure(async () => { throw new Error('storage_failed'); })).resolves.toBe('failed');
    expect(coordinator.isRequired()).toBe(true);
    await expect(coordinator.ensure(async () => undefined)).resolves.toBe('cleared');
    expect(coordinator.isRequired()).toBe(false);
  });

  it('rend la main à l’UI sans annuler la purge globale encore active', async () => {
    let release: () => void = () => {};
    const cleanup = new Promise<'cleared'>((resolve) => { release = () => resolve('cleared'); });

    await expect(observeExpiredSessionCleanup(cleanup, 1)).resolves.toBe('pending');
    release();
    await expect(cleanup).resolves.toBe('cleared');
  });
});
