import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Platform } from 'react-native';

import { clearLocalSessionDataOnDevice } from '@/lib/account-session.native';
import { settleSessionCleanup } from '@/lib/account-session-core';
import { finalizeConfirmedAccountAction } from '@/lib/account-action';
import { resolveAuthProvider, type AuthProvider as AuthProviderKind } from '@/lib/auth-policy';
import type { AuthSession, AuthUser } from '@/lib/auth-session-core';
import { authStatusAfterRestoreError } from '@/lib/auth-restore-state';
import {
  clearAuthSession,
  clearSocialCredentialState,
  createAndStoreDevelopmentSession,
  createAndStoreSocialSession,
  createSocialReauthenticationProof,
  deleteServerAccount,
  readAuthSession,
  revokeAuthSession,
} from '@/lib/auth-session-store';
import {
  expiredSessionCleanupCoordinator,
  observeExpiredSessionCleanup,
} from '@/lib/expired-session-cleanup';
import { isGoogleNativeAvailable } from '@/lib/social-auth-native';
import { emitSessionExpired, subscribeSessionExpired } from '@/lib/session-expiration';

type AuthStatus = 'checking' | 'expired' | 'restore-error' | 'signed-out' | 'signed-in';

type AuthContextValue = {
  provider: AuthProviderKind;
  status: AuthStatus;
  user: AuthUser | null;
  signInDevelopment: () => Promise<void>;
  signInSocial: () => Promise<boolean>;
  retrySessionRestore: () => Promise<void>;
  signOut: () => Promise<void>;
  deleteDevelopmentProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const cleanupObservationMs = 6_000;

function activeProvider(): AuthProviderKind {
  const platform = Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';
  return resolveAuthProvider({
    isDevelopment: __DEV__,
    deploymentEnvironment: process.env.EXPO_PUBLIC_DEPLOYMENT_ENV?.trim() || 'production',
    developmentAuthEnabled: process.env.EXPO_PUBLIC_DEV_AUTH_MODE === 'true',
    platform,
    googleConfigured: platform === 'android' && isGoogleNativeAvailable(),
    appleConfigured: platform === 'ios',
  });
}

async function clearExpiredSessionData(): Promise<void> {
  await settleSessionCleanup([clearAuthSession, clearLocalSessionDataOnDevice]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const provider = activeProvider();
  const [status, setStatus] = useState<AuthStatus>('checking');
  const [session, setSession] = useState<AuthSession | null>(null);
  const restoreGeneration = useRef(0);

  const settleExpiredCleanup = useCallback(async (generation: number) => {
    const cleanup = expiredSessionCleanupCoordinator.ensure(clearExpiredSessionData);
    const observed = await observeExpiredSessionCleanup(cleanup, cleanupObservationMs);
    if (generation !== restoreGeneration.current) return;
    setSession(null);
    setStatus(observed === 'cleared' && !expiredSessionCleanupCoordinator.isRequired() ? 'expired' : 'restore-error');

    if (observed === 'pending') {
      void cleanup.then((result) => {
        if (generation !== restoreGeneration.current) return;
        setSession(null);
        setStatus(result === 'cleared' && !expiredSessionCleanupCoordinator.isRequired() ? 'expired' : 'restore-error');
      });
    }
  }, []);

  const handleRestoreFailure = useCallback(async (error: unknown, generation: number) => {
    if (generation !== restoreGeneration.current) return;
    setSession(null);
    if (authStatusAfterRestoreError(error) !== 'expired') {
      setStatus('restore-error');
      return;
    }
    expiredSessionCleanupCoordinator.require();
    setStatus('checking');
    await settleExpiredCleanup(generation);
  }, [settleExpiredCleanup]);

  const retrySessionRestore = useCallback(async () => {
    const generation = ++restoreGeneration.current;
    setSession(null);
    setStatus('checking');
    if (expiredSessionCleanupCoordinator.isRequired()) {
      await settleExpiredCleanup(generation);
      return;
    }
    try {
      const stored = await readAuthSession(provider);
      if (generation !== restoreGeneration.current) return;
      setSession(stored);
      setStatus(stored ? 'signed-in' : 'signed-out');
    } catch (error) {
      await handleRestoreFailure(error, generation);
    }
  }, [handleRestoreFailure, provider, settleExpiredCleanup]);

  useEffect(() => {
    const generation = ++restoreGeneration.current;
    if (expiredSessionCleanupCoordinator.isRequired()) {
      void settleExpiredCleanup(generation);
    } else {
      void readAuthSession(provider)
        .then((stored) => {
          if (generation !== restoreGeneration.current) return;
          setSession(stored);
          setStatus(stored ? 'signed-in' : 'signed-out');
        })
        .catch((error: unknown) => {
          void handleRestoreFailure(error, generation);
        });
    }
    return () => {
      restoreGeneration.current += 1;
    };
  }, [handleRestoreFailure, provider, settleExpiredCleanup]);

  useEffect(() => subscribeSessionExpired(() => {
    const generation = ++restoreGeneration.current;
    expiredSessionCleanupCoordinator.require();
    setSession(null);
    setStatus('checking');
    void settleExpiredCleanup(generation);
  }), [settleExpiredCleanup]);

  const discardObsoleteSignIn = useCallback(async () => {
    expiredSessionCleanupCoordinator.require();
    emitSessionExpired();
    await expiredSessionCleanupCoordinator.ensure(clearExpiredSessionData);
    throw new Error('auth_operation_obsolete');
  }, []);

  const signInDevelopment = useCallback(async () => {
    if (provider !== 'development') throw new Error('development_auth_unavailable');
    if (expiredSessionCleanupCoordinator.isRequired()) throw new Error('auth_cleanup_pending');
    const generation = ++restoreGeneration.current;
    const nextSession = await createAndStoreDevelopmentSession();
    if (generation !== restoreGeneration.current || expiredSessionCleanupCoordinator.isRequired()) {
      await discardObsoleteSignIn();
    }
    setSession(nextSession);
    setStatus('signed-in');
  }, [discardObsoleteSignIn, provider]);

  const signInSocial = useCallback(async () => {
    if (provider !== 'google' && provider !== 'apple') throw new Error('social_auth_unavailable');
    if (expiredSessionCleanupCoordinator.isRequired()) throw new Error('auth_cleanup_pending');
    const generation = ++restoreGeneration.current;
    const nextSession = await createAndStoreSocialSession(provider);
    if (!nextSession) return false;
    if (generation !== restoreGeneration.current || expiredSessionCleanupCoordinator.isRequired()) {
      await discardObsoleteSignIn();
    }
    setSession(nextSession);
    setStatus('signed-in');
    return true;
  }, [discardObsoleteSignIn, provider]);

  const signOut = useCallback(async () => {
    restoreGeneration.current += 1;
    await finalizeConfirmedAccountAction({
      remoteAction: revokeAuthSession,
      localCleanup: [
        () => clearSocialCredentialState(provider),
        clearAuthSession,
        clearLocalSessionDataOnDevice,
      ],
    });
    setSession(null);
    setStatus('signed-out');
  }, [provider]);

  const deleteDevelopmentProfile = useCallback(async () => {
    restoreGeneration.current += 1;
    let reauthenticationProof: string | undefined;
    if (provider === 'google' || provider === 'apple') {
      reauthenticationProof = await createSocialReauthenticationProof(provider) ?? undefined;
      if (!reauthenticationProof) throw new Error('reauthentication_cancelled');
    }
    await finalizeConfirmedAccountAction({
      remoteAction: () => deleteServerAccount(reauthenticationProof),
      localCleanup: [
        () => clearSocialCredentialState(provider),
        clearAuthSession,
        clearLocalSessionDataOnDevice,
      ],
    });
    setSession(null);
    setStatus('signed-out');
  }, [provider]);

  const value = useMemo<AuthContextValue>(
    () => ({
      deleteDevelopmentProfile,
      provider,
      retrySessionRestore,
      signInDevelopment,
      signInSocial,
      signOut,
      status,
      user: session?.user ?? null,
    }),
    [deleteDevelopmentProfile, provider, retrySessionRestore, session, signInDevelopment, signInSocial, signOut, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
