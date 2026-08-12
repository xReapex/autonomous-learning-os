import { describe, expect, it } from 'vitest';

import { clearLocalSessionData, localSessionDataKeys } from './account-session-core';

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
});
