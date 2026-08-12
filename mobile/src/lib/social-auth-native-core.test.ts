import { describe, expect, it, vi } from 'vitest';

import {
  createNativeIdentityRequester,
  isAppleNativeConfigured,
  isGoogleNativeConfigured,
} from './social-auth-native-core';

describe('adaptateurs d’identité sociale native', () => {
  it('n’active Google que sur Android avec un client ID OAuth externe valide', () => {
    expect(isGoogleNativeConfigured('android', true)).toBe(true);
    expect(isGoogleNativeConfigured('android', false)).toBe(false);
    expect(isGoogleNativeConfigured('ios', true)).toBe(false);
  });

  it('n’active Apple que sur iOS lorsque la capability native est disponible', () => {
    expect(isAppleNativeConfigured('ios', true)).toBe(true);
    expect(isAppleNativeConfigured('ios', false)).toBe(false);
    expect(isAppleNativeConfigured('android', true)).toBe(false);
  });

  it('transmet le nonce backend au module Google Credential Manager et retourne son ID token', async () => {
    const google = {
      requestIdToken: vi.fn(async () => ({ type: 'success' as const, idToken: 'header.payload.signature' })),
    };
    const requester = createNativeIdentityRequester({
      platform: 'android',
      googleConfigured: true,
      google,
      apple: null,
    });

    await expect(requester({ provider: 'google', nonce: 'nonce-backend' })).resolves.toEqual({
      type: 'success',
      idToken: 'header.payload.signature',
    });
    expect(google.requestIdToken).toHaveBeenCalledWith({ nonce: 'nonce-backend' });
  });

  it('transmet le nonce à Apple et distingue l’annulation d’une erreur', async () => {
    const apple = {
      isAvailable: vi.fn(async () => true),
      requestIdToken: vi.fn(async () => ({ type: 'cancelled' as const })),
    };
    const requester = createNativeIdentityRequester({
      platform: 'ios',
      googleConfigured: false,
      google: null,
      apple,
    });

    await expect(requester({ provider: 'apple', nonce: 'nonce-backend' })).resolves.toEqual({ type: 'cancelled' });
    expect(apple.requestIdToken).toHaveBeenCalledWith({ nonce: 'nonce-backend' });
  });

  it('échoue fermé avant toute UI si le provider demandé est absent ou mal configuré', async () => {
    const requester = createNativeIdentityRequester({
      platform: 'android',
      googleConfigured: false,
      google: null,
      apple: null,
    });

    await expect(requester({ provider: 'google', nonce: 'nonce' })).rejects.toThrow('social_auth_not_configured');
    await expect(requester({ provider: 'apple', nonce: 'nonce' })).rejects.toThrow('social_provider_unavailable');
  });
});
