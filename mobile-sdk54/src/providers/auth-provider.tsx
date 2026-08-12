import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { clearLocalSessionDataOnDevice } from '@/lib/account-session.native';
import { finalizeConfirmedAccountAction } from '@/lib/account-action';
import { resolveAuthProvider, type AuthProvider as AuthProviderKind } from '@/lib/auth-policy';
import type { AuthSession, AuthUser } from '@/lib/auth-session-core';
import {
  clearAuthSession,
  createAndStoreDevelopmentSession,
  deleteServerAccount,
  readAuthSession,
  revokeAuthSession,
} from '@/lib/auth-session-store';
import { subscribeSessionExpired } from '@/lib/session-expiration';

type AuthStatus = 'checking' | 'signed-out' | 'signed-in';

type AuthContextValue = {
  provider: AuthProviderKind;
  status: AuthStatus;
  user: AuthUser | null;
  signInDevelopment: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteDevelopmentProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function activeProvider(): AuthProviderKind {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return resolveAuthProvider({
    isDevelopment: __DEV__,
    deploymentEnvironment: process.env.EXPO_PUBLIC_DEPLOYMENT_ENV?.trim() || 'production',
    developmentAuthEnabled: process.env.EXPO_PUBLIC_DEV_AUTH_MODE === 'true',
    platform,
    googleConfigured: false,
    appleConfigured: false,
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const provider = activeProvider();
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [session, setSession] = useState<AuthSession | null>(null);

  useEffect(() => {
    let active = true;
    void readAuthSession(provider)
      .then((stored) => {
        if (!active) return;
        setSession(stored);
        setStatus(stored ? 'signed-in' : 'signed-out');
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus('signed-out');
      });
    return () => {
      active = false;
    };
  }, [provider]);

  useEffect(() => subscribeSessionExpired(() => {
    void Promise.all([clearAuthSession(), clearLocalSessionDataOnDevice()]).finally(() => {
      setSession(null);
      setStatus('signed-out');
    });
  }), []);

  const signInDevelopment = useCallback(async () => {
    if (provider !== 'development') throw new Error('development_auth_unavailable');
    const nextSession = await createAndStoreDevelopmentSession();
    setSession(nextSession);
    setStatus('signed-in');
  }, [provider]);

  const signOut = useCallback(async () => {
    await finalizeConfirmedAccountAction({
      remoteAction: revokeAuthSession,
      localCleanup: [clearAuthSession, clearLocalSessionDataOnDevice],
    });
    setSession(null);
    setStatus('signed-out');
  }, []);

  const deleteDevelopmentProfile = useCallback(async () => {
    await finalizeConfirmedAccountAction({
      remoteAction: deleteServerAccount,
      localCleanup: [clearAuthSession, clearLocalSessionDataOnDevice],
    });
    setSession(null);
    setStatus('signed-out');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      deleteDevelopmentProfile,
      provider,
      signInDevelopment,
      signOut,
      status,
      user: session?.user ?? null,
    }),
    [deleteDevelopmentProfile, provider, session, signInDevelopment, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
