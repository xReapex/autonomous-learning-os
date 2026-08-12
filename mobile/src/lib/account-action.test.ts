import { describe, expect, it } from 'vitest';

import { finalizeConfirmedAccountAction, runAccountAction } from './account-action';

describe('action de compte', () => {
  it('retourne success lorsque l’opération serveur aboutit', async () => {
    await expect(runAccountAction(async () => undefined)).resolves.toBe('success');
  });

  it('absorbe le rejet et retourne error pour éviter une promesse UI non gérée', async () => {
    await expect(runAccountAction(async () => {
      throw new Error('network');
    })).resolves.toBe('error');
  });

  it('ne purge rien localement lorsque le serveur refuse l’opération', async () => {
    const calls: string[] = [];

    await expect(finalizeConfirmedAccountAction({
      remoteAction: async () => { throw new Error('network'); },
      localCleanup: [async () => { calls.push('local'); }],
    })).rejects.toThrow('network');

    expect(calls).toEqual([]);
  });

  it('tente toutes les purges locales après succès serveur sans rendre le succès réversible', async () => {
    const calls: string[] = [];

    await expect(finalizeConfirmedAccountAction({
      remoteAction: async () => { calls.push('server'); },
      localCleanup: [
        async () => { calls.push('provider'); throw new Error('provider_cleanup_failed'); },
        async () => { calls.push('session'); },
      ],
    })).resolves.toBeUndefined();

    expect(calls).toEqual(['server', 'provider', 'session']);
  });
});
