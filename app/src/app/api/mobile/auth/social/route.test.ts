import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as challenge } from './challenge/route';
import { POST as exchange } from './exchange/route';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'scio-social-route-'));
  vi.stubEnv('SCIO_AUTH_DATA_DIR', dataDirectory);
  vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'production');
  vi.stubEnv('SCIO_AUTH_MODE', 'social');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dataDirectory, { recursive: true, force: true });
});

describe('routes sociales SCIO', () => {
  it('reste indisponible sans audience fournisseur', async () => {
    const response = await challenge(new Request('http://localhost/api/mobile/auth/social/challenge?provider=google', { method: 'POST' }));
    expect(response.status).toBe(503);
  });

  it('émet un challenge opaque uniquement pour un fournisseur configuré', async () => {
    vi.stubEnv('SCIO_GOOGLE_SERVER_CLIENT_ID', 'google-client');
    const response = await challenge(new Request('http://localhost/api/mobile/auth/social/challenge?provider=google', { method: 'POST' }));
    const payload = await response.json();
    expect(response.status).toBe(201);
    expect(payload.state).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(payload.nonce).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(response.headers.get('cache-control')).toContain('no-store');
  });

  it('refuse la preview et les fournisseurs inconnus', async () => {
    vi.stubEnv('SCIO_GOOGLE_SERVER_CLIENT_ID', 'google-client');
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
    const preview = await challenge(new Request('http://localhost/api/mobile/auth/social/challenge?provider=google', { method: 'POST' }));
    const unknown = await challenge(new Request('http://localhost/api/mobile/auth/social/challenge?provider=other', { method: 'POST' }));
    expect(preview.status).toBe(403);
    expect(unknown.status).toBe(400);
  });

  it('borne et valide le corps avant toute vérification distante', async () => {
    const invalid = await exchange(new Request('http://localhost/api/mobile/auth/social/exchange', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    }));
    const oversized = await exchange(new Request('http://localhost/api/mobile/auth/social/exchange', {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '25000' }, body: '{}',
    }));
    expect(invalid.status).toBe(400);
    expect(oversized.status).toBe(413);
  });
});
