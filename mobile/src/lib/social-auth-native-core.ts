import type { SocialProvider } from './auth-api';

type PlatformName = 'android' | 'ios' | 'web';
type NativeIdentityResult = { type: 'cancelled' } | { type: 'success'; idToken: string };

type GoogleAdapter = {
  requestIdToken: (input: { nonce: string }) => Promise<NativeIdentityResult>;
};

type AppleAdapter = {
  isAvailable: () => Promise<boolean>;
  requestIdToken: (input: { nonce: string }) => Promise<NativeIdentityResult>;
};

type NativeIdentityOptions = {
  platform: PlatformName;
  googleConfigured: boolean;
  google: GoogleAdapter | null;
  apple: AppleAdapter | null;
};

export function isGoogleNativeConfigured(platform: PlatformName, configured: boolean): boolean {
  return platform === 'android' && configured;
}

export function isAppleNativeConfigured(platform: PlatformName, available: boolean): boolean {
  return platform === 'ios' && available;
}

export function createNativeIdentityRequester(options: NativeIdentityOptions) {
  return async function requestIdentity(input: {
    provider: SocialProvider;
    nonce: string;
  }): Promise<NativeIdentityResult> {
    if (input.provider === 'google') {
      if (options.platform !== 'android') throw new Error('social_provider_unavailable');
      if (!options.googleConfigured || !options.google) throw new Error('social_auth_not_configured');
      return options.google.requestIdToken({ nonce: input.nonce });
    }

    if (options.platform !== 'ios') throw new Error('social_provider_unavailable');
    if (!options.apple || !(await options.apple.isAvailable())) throw new Error('social_auth_not_configured');
    return options.apple.requestIdToken({ nonce: input.nonce });
  };
}
