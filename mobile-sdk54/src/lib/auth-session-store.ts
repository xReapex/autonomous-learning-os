import * as SecureStore from 'expo-secure-store';

import { settleSessionCleanup } from './account-session-core';
import { createAuthApi } from './auth-api';
import type { AuthProvider } from './auth-policy';
import type { AuthSession } from './auth-session-core';
import { resolveApiConfiguration } from './api-url';
import { authAccessTokenKey, authSessionStorageKey } from './secure-store-keys';

function apiClient() {
  const configuration = resolveApiConfiguration(
    process.env.EXPO_PUBLIC_API_URL,
    false,
    false,
  );
  if (configuration.mode !== 'remote') throw new Error('auth_api_required');

  return createAuthApi({
    baseUrl: configuration.baseUrl,
    tokenStorage: {
      get: () => SecureStore.getItemAsync(authAccessTokenKey),
      set: (token) =>
        SecureStore.setItemAsync(authAccessTokenKey, token, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      clear: () => SecureStore.deleteItemAsync(authAccessTokenKey),
    },
  });
}

export async function readAuthSession(provider: AuthProvider): Promise<AuthSession | null> {
  if (provider === 'unavailable') return null;
  const session = await apiClient().restore();
  if (!session) return null;
  if (session.user.provider !== provider) throw new Error('auth_session_expired');
  return session;
}

export function createAndStoreDevelopmentSession(): Promise<AuthSession> {
  return apiClient().signInDevelopment();
}

export function revokeAuthSession(): Promise<void> {
  return apiClient().signOut();
}

export function deleteServerAccount(): Promise<void> {
  return apiClient().deleteAccount();
}

export async function clearAuthSession(): Promise<void> {
  await settleSessionCleanup([
    () => SecureStore.deleteItemAsync(authAccessTokenKey),
    () => SecureStore.deleteItemAsync(authSessionStorageKey),
  ]);
}
