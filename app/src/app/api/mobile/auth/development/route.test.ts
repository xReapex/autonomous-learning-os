import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST } from './route';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'scio-auth-route-'));
  vi.stubEnv('SCIO_AUTH_DATA_DIR', dataDirectory);
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dataDirectory, { recursive: true, force: true });
});

describe('POST /api/mobile/auth/development', () => {
  it('émet une session opaque de démonstration hors production', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
    vi.stubEnv('SCIO_AUTH_MODE', 'development');

    const response = await POST();
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload).toMatchObject({
      user: { provider: 'development' },
      entitlement: 'demo',
    });
    expect(payload.token).toMatch(/^scio_[A-Za-z0-9_-]{40,}$/);
  });

  it('utilise le même build Node production dans l’environnement preview', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
    vi.stubEnv('SCIO_AUTH_MODE', 'development');

    const response = await POST();

    expect(response.status).toBe(201);
  });

  it('borne la création de profils preview et limite la session à 24 heures', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
    vi.stubEnv('SCIO_AUTH_MODE', 'development');
    vi.stubEnv('SCIO_PREVIEW_MAX_USERS', '1');

    const first = await POST();
    const firstPayload = await first.json();
    const second = await POST();

    expect(first.status).toBe(201);
    expect(Date.parse(firstPayload.expiresAt) - Date.now()).toBeLessThanOrEqual(24 * 60 * 60 * 1_000);
    expect(Date.parse(firstPayload.expiresAt) - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1_000);
    expect(second.status).toBe(429);
  });

  it('échoue fermé en production même si le mode est demandé', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'production');
    vi.stubEnv('SCIO_AUTH_MODE', 'development');

    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: { code: 'development_auth_forbidden' } });
  });

  it('échoue fermé lorsque le mode de développement n’est pas configuré', async () => {
    vi.stubEnv('NODE_ENV', 'test');
    vi.stubEnv('SCIO_AUTH_MODE', 'disabled');

    const response = await POST();

    expect(response.status).toBe(403);
  });
});
