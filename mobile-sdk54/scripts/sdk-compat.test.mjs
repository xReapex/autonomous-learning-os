import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const authProvider = readFileSync(new URL('../src/providers/auth-provider.tsx', import.meta.url), 'utf8');

test('compatibility copy targets the Expo Go SDK 54 runtime', () => {
  assert.match(packageJson.dependencies.expo, /^~54\./);
  assert.match(packageJson.dependencies['react-native'], /^0\.81\./);
});

test('la preview purge les sessions expirées et finalise les actions après succès serveur', () => {
  assert.match(authProvider, /subscribeSessionExpired/);
  assert.match(authProvider, /finalizeConfirmedAccountAction/);
  assert.doesNotMatch(authProvider, /createAndStoreSocialSession|social-auth-native/);
});
