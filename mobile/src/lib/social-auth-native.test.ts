/* eslint-disable import/first */
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));
vi.mock('expo-apple-authentication', () => ({
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButton: () => null,
  isAvailableAsync: vi.fn(),
  signInAsync: vi.fn(),
}));
vi.mock('../../modules/scio-google-auth', () => ({
  default: { clearCredentialState: vi.fn(), isConfigured: vi.fn(() => true), requestIdToken: vi.fn() },
}));

import * as AppleAuthentication from 'expo-apple-authentication';
import ScioGoogleAuth from '../../modules/scio-google-auth';
import {
  appleNativeAdapter,
  googleNativeAdapter,
  socialAuthConfiguration,
} from './social-auth-native';

describe('ponts SDK57 d’auth native', () => {
  it('lit la configuration Google injectée au build sans exposer sa valeur au bundle', async () => {
    expect(socialAuthConfiguration({ platform: 'android', googleConfigured: true, appleAvailable: false })).toEqual({
      googleConfigured: true,
      appleConfigured: false,
    });
    vi.mocked(ScioGoogleAuth!.requestIdToken).mockResolvedValue({
      type: 'success',
      idToken: 'header.payload.signature',
    });

    await expect(googleNativeAdapter.requestIdToken({
      nonce: 'n'.repeat(43),
    })).resolves.toEqual({ type: 'success', idToken: 'header.payload.signature' });
  });

  it('retourne une annulation Apple sans la transformer en erreur', async () => {
    vi.mocked(AppleAuthentication.signInAsync).mockRejectedValue({ code: 'ERR_REQUEST_CANCELED' });

    await expect(appleNativeAdapter.requestIdToken({ nonce: 'n'.repeat(43) })).resolves.toEqual({ type: 'cancelled' });
    expect(AppleAuthentication.signInAsync).toHaveBeenCalledWith({
      nonce: 'n'.repeat(43),
      requestedScopes: [],
    });
  });

  it('rejette une réponse Apple sans identityToken', async () => {
    vi.mocked(AppleAuthentication.signInAsync).mockResolvedValue({ identityToken: null } as never);

    await expect(appleNativeAdapter.requestIdToken({ nonce: 'n'.repeat(43) })).rejects.toThrow('social_identity_invalid');
  });
});
