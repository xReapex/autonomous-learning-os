import { requireOptionalNativeModule } from 'expo-modules-core';

type GoogleIdentityResult = { type: 'cancelled' } | { type: 'success'; idToken: string };

type ScioGoogleAuthModule = {
  isConfigured(): boolean;
  requestIdToken(nonce: string): Promise<GoogleIdentityResult>;
  clearCredentialState(): Promise<void>;
};

export default requireOptionalNativeModule<ScioGoogleAuthModule>('ScioGoogleAuth');
