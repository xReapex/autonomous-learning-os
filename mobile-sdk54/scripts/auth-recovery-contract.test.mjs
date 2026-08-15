import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(path, import.meta.url), 'utf8');

test('l’authentification distingue expiration et restauration indisponible avec un retry explicite', async () => {
  const [provider, screen, root] = await Promise.all([
    source('../src/providers/auth-provider.tsx'),
    source('../src/components/auth-screen.tsx'),
    source('../src/app/_layout.tsx'),
  ]);

  assert.match(provider, /'restore-error'/);
  assert.match(provider, /'expired'/);
  assert.match(provider, /retrySessionRestore/);
  assert.match(provider, /expiredSessionCleanupCoordinator/);
  assert.match(provider, /emitSessionExpired\(\)/);
  assert.match(provider, /setSession\(null\);\s*setStatus\('checking'\);\s*void settleExpiredCleanup/);
  assert.match(screen, /status === 'restore-error'/);
  assert.match(screen, /auth\.retry/);
  assert.match(screen, /auth\.expiredBody/);
  assert.match(root, /status !== 'signed-in'/);
});

test('les informations légales sont accessibles avant connexion et les erreurs suivent le fournisseur', async () => {
  const screen = await source('../src/components/auth-screen.tsx');

  assert.match(screen, /openLegalPage\('privacy'\)/);
  assert.match(screen, /openLegalPage\('terms'\)/);
  assert.match(screen, /auth\.legalLinkError/);
  assert.match(screen, /accessibilityRole="link"/);
  assert.match(screen, /auth\.errorDevelopment/);
  assert.match(screen, /auth\.errorSocial/);
  assert.match(screen, /accessibilityRole="header"/);
});

test('les suppressions locales attendent toutes leurs branches et propagent les échecs', async () => {
  const [store, cleanup] = await Promise.all([
    source('../src/lib/auth-session-store.ts'),
    source('../src/lib/account-session-core.ts'),
  ]);
  assert.match(store, /settleSessionCleanup/);
  assert.match(cleanup, /Promise\.allSettled/);
  assert.match(cleanup, /auth_local_cleanup_failed/);
});
