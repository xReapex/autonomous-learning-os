import type { AuthProvider } from './auth-policy';

export type AuthUser = {
  id: string;
  displayName: string;
  provider: Exclude<AuthProvider, 'unavailable'>;
};

export type AuthSession = {
  user: AuthUser;
  entitlement: 'demo' | 'full';
  expiresAt: string;
};
