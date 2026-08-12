import { describe, expect, it } from 'vitest';

import { authAccessTokenKey, authSessionStorageKey, legacyTechnicalSessionKey } from './secure-store-keys';

const expoSecureStoreKeyPattern = /^[\w.-]+$/;

describe('clés Expo SecureStore', () => {
  it.each([
    ['auth access token', authAccessTokenKey],
    ['auth session', authSessionStorageKey],
    ['legacy technical session', legacyTechnicalSessionKey],
  ])('%s utilise uniquement les caractères acceptés par Expo SecureStore', (_name, key) => {
    expect(key).toMatch(expoSecureStoreKeyPattern);
  });
});
