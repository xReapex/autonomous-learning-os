import { describe, expect, it, vi } from 'vitest';

import { createSocialReauthentication, createSocialSignIn, SocialSignInError } from './social-auth-core';

const challenge = {
  state: 's'.repeat(43),
  nonce: 'n'.repeat(43),
  expiresAt: '2026-09-10T12:00:00.000Z',
};

const session = {
  user: { id: `usr_${'u'.repeat(32)}`, displayName: 'Ada', provider: 'google' as const },
  entitlement: 'full' as const,
  expiresAt: '2026-09-10T12:30:00.000Z',
};

describe('orchestration de l’auth sociale native', () => {
  it('obtient le challenge avant le jeton natif puis échange la preuve liée au nonce', async () => {
    const calls: string[] = [];
    const api = {
      createSocialChallenge: vi.fn(async () => {
        calls.push('challenge');
        return challenge;
      }),
      exchangeSocialIdentity: vi.fn(async () => {
        calls.push('exchange');
        return session;
      }),
    };
    const requestIdentity = vi.fn(async ({ nonce }: { nonce: string }) => {
      calls.push(`native:${nonce}`);
      return { type: 'success' as const, idToken: 'header.payload.signature' };
    });

    const signIn = createSocialSignIn({ api, requestIdentity });

    await expect(signIn('google')).resolves.toEqual({ type: 'success', session });
    expect(calls).toEqual(['challenge', `native:${challenge.nonce}`, 'exchange']);
    expect(requestIdentity).toHaveBeenCalledWith({ provider: 'google', nonce: challenge.nonce });
    expect(api.exchangeSocialIdentity).toHaveBeenCalledWith(
      'google',
      challenge.state,
      'header.payload.signature',
    );
  });

  it('traite l’annulation native comme un résultat neutre sans appeler l’échange', async () => {
    const exchangeSocialIdentity = vi.fn();
    const signIn = createSocialSignIn({
      api: {
        createSocialChallenge: vi.fn(async () => challenge),
        exchangeSocialIdentity,
      },
      requestIdentity: vi.fn(async () => ({ type: 'cancelled' as const })),
    });

    await expect(signIn('apple')).resolves.toEqual({ type: 'cancelled' });
    expect(exchangeSocialIdentity).not.toHaveBeenCalled();
  });

  it('échoue fermé si le provider natif renvoie une preuve vide ou mal formée', async () => {
    const signIn = createSocialSignIn({
      api: {
        createSocialChallenge: vi.fn(async () => challenge),
        exchangeSocialIdentity: vi.fn(),
      },
      requestIdentity: vi.fn(async () => ({ type: 'success' as const, idToken: 'court' })),
    });

    await expect(signIn('google')).rejects.toEqual(new SocialSignInError('social_identity_invalid'));
  });

  it('empêche deux ouvertures simultanées de la feuille native', async () => {
    let resolveNative!: (value: { type: 'cancelled' }) => void;
    const nativeResult = new Promise<{ type: 'cancelled' }>((resolve) => {
      resolveNative = resolve;
    });
    const signIn = createSocialSignIn({
      api: {
        createSocialChallenge: vi.fn(async () => challenge),
        exchangeSocialIdentity: vi.fn(),
      },
      requestIdentity: vi.fn(async () => nativeResult),
    });

    const first = signIn('google');
    await expect(signIn('google')).rejects.toEqual(new SocialSignInError('social_auth_in_progress'));
    resolveNative({ type: 'cancelled' });
    await expect(first).resolves.toEqual({ type: 'cancelled' });
  });

  it('réauthentifie sans émettre ni remplacer une session SCIO', async () => {
    const proof = `reauth_${'p'.repeat(43)}`;
    const api = {
      createReauthenticationChallenge: vi.fn(async () => challenge),
      exchangeReauthenticationIdentity: vi.fn(async () => proof),
    };
    const requestIdentity = vi.fn(async () => ({
      type: 'success' as const,
      idToken: 'header.payload.signature',
    }));
    const reauthenticate = createSocialReauthentication({ api, requestIdentity });

    await expect(reauthenticate('google')).resolves.toEqual({ type: 'success', proof });
    expect(api.exchangeReauthenticationIdentity).toHaveBeenCalledWith(
      'google',
      challenge.state,
      'header.payload.signature',
    );
  });
});
