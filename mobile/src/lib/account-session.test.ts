import { describe, expect, it } from 'vitest';

import { clearLocalSessionData, localSessionDataKeys, settleSessionCleanup } from './account-session-core';

describe('cycle de session locale', () => {
  it('révoque la session moteur et efface toutes les données non partitionnées', async () => {
    const calls: string[] = [];
    let removedKeys: readonly string[] = [];

    await clearLocalSessionData({
      clearSession: async () => {
        calls.push('session');
      },
      removeStorage: async (keys) => {
        calls.push('storage');
        removedKeys = keys;
      },
    });

    expect(calls.sort()).toEqual(['session', 'storage']);
    expect(removedKeys).toEqual(localSessionDataKeys);
    expect(removedKeys).toContain('scio:data-cache');
    expect(removedKeys).toContain('scio:generated-data');
    expect(removedKeys).toContain('scio:rewards');
    expect(removedKeys).toContain('scio:generation-job');
    expect(removedKeys).not.toContain('scio:locale');
  });

  it('attend toutes les branches avant de signaler une suppression incomplète', async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => { release = resolve; });
    const cleanup = settleSessionCleanup([
      async () => { throw new Error('secure_store_failed'); },
      () => pending,
    ]);
    const outcome = cleanup.then(() => 'resolved', () => 'rejected');

    await expect(Promise.race([outcome, Promise.resolve('pending')])).resolves.toBe('pending');
    release();
    await expect(cleanup).rejects.toThrow('auth_local_cleanup_failed');
  });
});
