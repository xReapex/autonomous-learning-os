import * as AppleAuthentication from 'expo-apple-authentication';

import ScioGoogleAuth from '../../modules/scio-google-auth';

export const googleNativeAdapter = {
  requestIdToken: ({ nonce }: { nonce: string }) =>
    ScioGoogleAuth ? ScioGoogleAuth.requestIdToken(nonce) : Promise.reject(new Error('social_auth_not_configured')),
};

export function isGoogleNativeAvailable(): boolean {
  try {
    return ScioGoogleAuth?.isConfigured() === true;
  } catch {
    return false;
  }
}

export async function clearGoogleCredentialState(): Promise<void> {
  if (ScioGoogleAuth) await ScioGoogleAuth.clearCredentialState();
}

export const appleNativeAdapter = {
  isAvailable: () => AppleAuthentication.isAvailableAsync(),
  async requestIdToken({ nonce }: { nonce: string }) {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [],
        nonce,
      });
      if (!credential.identityToken) throw new Error('social_identity_invalid');
      return { type: 'success' as const, idToken: credential.identityToken };
    } catch (error) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        error.code === 'ERR_REQUEST_CANCELED'
      ) {
        return { type: 'cancelled' as const };
      }
      throw error;
    }
  },
};

export function socialAuthConfiguration(input: {
  platform: 'android' | 'ios' | 'web';
  googleConfigured: boolean;
  appleAvailable: boolean;
}) {
  return {
    googleConfigured: input.platform === 'android' && input.googleConfigured,
    appleConfigured: input.platform === 'ios' && input.appleAvailable,
  };
}
