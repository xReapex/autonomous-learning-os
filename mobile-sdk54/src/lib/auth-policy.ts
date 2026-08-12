export type AuthProvider = 'development' | 'google' | 'apple' | 'unavailable';

type AuthPolicyInput = {
  isDevelopment?: boolean;
  deploymentEnvironment: string;
  developmentAuthEnabled: boolean;
  platform: 'android' | 'ios' | 'web';
  googleConfigured: boolean;
  appleConfigured: boolean;
};

export function resolveAuthProvider(input: AuthPolicyInput): AuthProvider {
  if (input.deploymentEnvironment === 'preview' && input.developmentAuthEnabled) return 'development';
  if (input.platform === 'android' && input.googleConfigured) return 'google';
  if (input.platform === 'ios' && input.appleConfigured) return 'apple';
  return 'unavailable';
}
