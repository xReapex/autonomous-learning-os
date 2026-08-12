import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { POST as createDevelopmentSession } from '../development/route';
import { DELETE, GET } from './route';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'scio-session-route-'));
  vi.stubEnv('SCIO_AUTH_DATA_DIR', dataDirectory);
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
  vi.stubEnv('SCIO_AUTH_MODE', 'development');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dataDirectory, { recursive: true, force: true });
});

async function issueToken(): Promise<string> {
  const response = await createDevelopmentSession();
  return (await response.json()).token as string;
}

describe('/api/mobile/auth/session', () => {
  it('retourne l’identité sans réexposer le jeton', async () => {
    const token = await issueToken();
    const response = await GET(
      new Request('http://localhost/api/mobile/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toContain('no-store');
    expect(payload).toMatchObject({ user: { provider: 'development' }, entitlement: 'demo' });
    expect(payload).not.toHaveProperty('token');
  });

  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer invalid'])('refuse un header invalide : %s', async (authorization) => {
    const headers = authorization ? { Authorization: authorization } : undefined;
    const response = await GET(new Request('http://localhost/api/mobile/auth/session', { headers }));
    expect(response.status).toBe(401);
  });

  it('révoque immédiatement le Bearer courant', async () => {
    const token = await issueToken();
    const request = () =>
      new Request('http://localhost/api/mobile/auth/session', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

    const revoked = await DELETE(request());
    expect(revoked.status).toBe(204);

    const after = await GET(
      new Request('http://localhost/api/mobile/auth/session', {
        headers: { Authorization: `Bearer ${token}` },
      }),
    );
    expect(after.status).toBe(401);
  });
});
