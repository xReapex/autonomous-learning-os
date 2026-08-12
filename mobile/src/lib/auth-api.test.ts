import { describe, expect, it, vi } from 'vitest';

import { createAuthApi } from './auth-api';

function tokenStorage(initial: string | null = null) {
  let value = initial;
  return {
    get: async () => value,
    set: async (token: string) => {
      value = token;
    },
    clear: async () => {
      value = null;
    },
    value: () => value,
  };
}

const issuedPayload = {
  token: `scio_${'a'.repeat(43)}`,
  user: {
    id: `usr_${'b'.repeat(32)}`,
    displayName: 'Profil de développement',
    provider: 'development',
  },
  entitlement: 'demo',
  expiresAt: '2026-09-10T12:00:00.000Z',
};

describe('client SCIO Auth API', () => {
  it('émet une session de développement et stocke uniquement le jeton opaque', async () => {
    const storage = tokenStorage();
    const fetchImpl = vi.fn(async () => Response.json(issuedPayload, { status: 201 }));
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api/', fetchImpl, tokenStorage: storage });

    const session = await api.signInDevelopment();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/auth/development',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(storage.value()).toBe(issuedPayload.token);
    expect(session).toEqual({
      user: issuedPayload.user,
      entitlement: 'demo',
      expiresAt: issuedPayload.expiresAt,
    });
  });

  it('restaure une session en la validant auprès du serveur', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const fetchImpl = vi.fn(async () => Response.json({
      user: issuedPayload.user,
      entitlement: 'demo',
      expiresAt: issuedPayload.expiresAt,
    }));
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api', fetchImpl, tokenStorage: storage });

    await expect(api.restore()).resolves.toMatchObject({ user: issuedPayload.user });
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/auth/session',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${issuedPayload.token}` }) }),
    );
  });

  it('efface un jeton refusé par le serveur', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const api = createAuthApi({
      baseUrl: 'https://learning.scio.app/api',
      fetchImpl: vi.fn(async () => Response.json({ error: { code: 'session_unauthorized' } }, { status: 401 })),
      tokenStorage: storage,
    });

    await expect(api.restore()).resolves.toBeNull();
    expect(storage.value()).toBeNull();
  });

  it('révoque la session serveur avant d’effacer le jeton local', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const api = createAuthApi({
      baseUrl: 'https://learning.scio.app/api',
      fetchImpl: vi.fn(async () => new Response(null, { status: 204 })),
      tokenStorage: storage,
    });

    await api.signOut();

    expect(storage.value()).toBeNull();
  });

  it('conserve le jeton si la révocation serveur échoue', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const api = createAuthApi({
      baseUrl: 'https://learning.scio.app/api',
      fetchImpl: vi.fn(async () => Response.json({ error: { code: 'auth_unavailable' } }, { status: 503 })),
      tokenStorage: storage,
    });

    await expect(api.signOut()).rejects.toThrow('auth_revoke_failed');
    expect(storage.value()).toBe(issuedPayload.token);
  });

  it('supprime le compte serveur puis le jeton local', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api', fetchImpl, tokenStorage: storage });

    await api.deleteAccount();

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/auth/account',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(storage.value()).toBeNull();
  });

  it('rejette une réponse d’émission invalide sans stocker de jeton', async () => {
    const storage = tokenStorage();
    const api = createAuthApi({
      baseUrl: 'https://learning.scio.app/api',
      fetchImpl: vi.fn(async () => Response.json({ token: 'court' }, { status: 201 })),
      tokenStorage: storage,
    });

    await expect(api.signInDevelopment()).rejects.toThrow('auth_response_invalid');
    expect(storage.value()).toBeNull();
  });

  it('obtient un challenge social puis échange une preuve contre une session SCIO opaque', async () => {
    const storage = tokenStorage();
    const socialPayload = {
      ...issuedPayload,
      user: { ...issuedPayload.user, provider: 'google' },
    };
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.endsWith('/social/challenge?provider=google')) {
        return Response.json({ state: 's'.repeat(43), nonce: 'n'.repeat(43), expiresAt: issuedPayload.expiresAt }, { status: 201 });
      }
      return Response.json(socialPayload, { status: 201 });
    });
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api', fetchImpl, tokenStorage: storage });

    const challenge = await api.createSocialChallenge('google');
    const session = await api.exchangeSocialIdentity('google', challenge.state, 'id-token-value');

    expect(challenge.nonce).toBe('n'.repeat(43));
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://learning.scio.app/api/mobile/auth/social/exchange',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ provider: 'google', state: challenge.state, idToken: 'id-token-value' }),
      }),
    );
    expect(storage.value()).toBe(socialPayload.token);
    expect(session.user.provider).toBe('google');
  });

  it('ne stocke rien si le challenge ou la preuve sociale est refusé', async () => {
    const storage = tokenStorage();
    const api = createAuthApi({
      baseUrl: 'https://learning.scio.app/api',
      fetchImpl: vi.fn(async () => Response.json({ error: { code: 'social_auth_unavailable' } }, { status: 503 })),
      tokenStorage: storage,
    });

    await expect(api.createSocialChallenge('apple')).rejects.toThrow('social_auth_unavailable');
    await expect(api.exchangeSocialIdentity('apple', 's'.repeat(43), 'id-token')).rejects.toThrow('social_auth_unavailable');
    expect(storage.value()).toBeNull();
  });

  it('obtient une preuve de réauthentification sans remplacer le jeton SCIO courant', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const proof = `reauth_${'p'.repeat(43)}`;
    const fetchImpl = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target.includes('/reauthenticate/challenge')) {
        return Response.json({
          state: 's'.repeat(43),
          nonce: 'n'.repeat(43),
          expiresAt: issuedPayload.expiresAt,
        }, { status: 201 });
      }
      return Response.json({ proof, expiresAt: issuedPayload.expiresAt }, { status: 201 });
    });
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api', fetchImpl, tokenStorage: storage });

    const challenge = await api.createReauthenticationChallenge('google');
    await expect(api.exchangeReauthenticationIdentity(
      'google',
      challenge.state,
      'header.payload.signature',
    )).resolves.toBe(proof);
    expect(storage.value()).toBe(issuedPayload.token);
  });

  it('transmet la preuve de réauthentification lors de la suppression', async () => {
    const storage = tokenStorage(issuedPayload.token);
    const proof = `reauth_${'p'.repeat(43)}`;
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));
    const api = createAuthApi({ baseUrl: 'https://learning.scio.app/api', fetchImpl, tokenStorage: storage });

    await api.deleteAccount(proof);

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/auth/account',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ 'X-SCIO-Reauthentication': proof }),
      }),
    );
    expect(storage.value()).toBeNull();
  });
});
