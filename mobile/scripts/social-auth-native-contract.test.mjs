import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = (path) => readFileSync(resolve(root, path), 'utf8');

test('Google Credential Manager lie chaque ID token au nonce backend', () => {
  const kotlin = source('modules/scio-google-auth/android/src/main/java/expo/modules/sciogoogleauth/ScioGoogleAuthModule.kt');
  assert.match(kotlin, /CredentialManager\.create/);
  assert.match(kotlin, /\.setNonce\(nonce\)/);
  assert.match(kotlin, /GoogleIdTokenCredential\.createFrom/);
  assert.match(kotlin, /GetCredentialCancellationException/);
  assert.match(kotlin, /clearCredentialState\(ClearCredentialStateRequest\(\)\)/);
  assert.doesNotMatch(kotlin, /GoogleSignInOptions/);
});

test('le client ID Google vient uniquement de la configuration native de build', () => {
  const plugin = source('plugins/with-scio-google-auth.js');
  const module = source('modules/scio-google-auth/android/src/main/java/expo/modules/sciogoogleauth/ScioGoogleAuthModule.kt');
  assert.match(plugin, /SCIO_GOOGLE_SERVER_CLIENT_ID/);
  assert.doesNotMatch(plugin, /SCIO_GOOGLE_ANDROID_CLIENT_ID/);
  assert.doesNotMatch(plugin, /EXPO_PUBLIC/);
  assert.match(module, /io\.scio\.auth\.GOOGLE_SERVER_CLIENT_ID/);
});

test('le module Google est optionnel pour rester compatible iOS et Expo Go', () => {
  assert.match(source('modules/scio-google-auth/index.ts'), /requireOptionalNativeModule/);
});
