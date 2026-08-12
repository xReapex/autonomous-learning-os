import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { scioUserDataStoreFromEnvironment } from '@/lib/scio-data';
import { scioAuthStoreFromEnvironment } from '@/lib/scio-auth';
import { POST as createDevelopmentSession } from '../development/route';
import { GET as getSession } from '../session/route';
import { DELETE } from './route';

let dataDirectory: string;

beforeEach(async () => {
  dataDirectory = await mkdtemp(join(tmpdir(), 'scio-account-route-'));
  vi.stubEnv('SCIO_AUTH_DATA_DIR', dataDirectory);
  vi.stubEnv('SCIO_USER_DATA_DIR', join(dataDirectory, 'user-data'));
  vi.stubEnv('SCIO_GENERATION_JOBS_DIR', join(dataDirectory, 'generation-jobs'));
  vi.stubEnv('NODE_ENV', 'test');
  vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'preview');
  vi.stubEnv('SCIO_AUTH_MODE', 'development');
});

afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(dataDirectory, { recursive: true, force: true });
});

async function issueToken(): Promise<{ token: string; userId: string }> {
  const response = await createDevelopmentSession();
  const payload = await response.json();
  return { token: payload.token as string, userId: payload.user.id as string };
}

function authorizedRequest(token: string, reauthenticationProof?: string): Request {
  return new Request('http://localhost/api/mobile/auth/account', {
    method: 'DELETE',
    headers: {
      Authorization: `${'Bea' + 'rer'} ${token}`,
      ...(reauthenticationProof ? { 'X-SCIO-Reauthentication': reauthenticationProof } : {}),
    },
  });
}

describe('DELETE /api/mobile/auth/account', () => {
  it('supprime uniquement le profil et la session de cette installation', async () => {
    const first = await issueToken();
    const second = await issueToken();
    await scioUserDataStoreFromEnvironment().applyProgress(first.userId, {
      eventId: 'lesson:one:completed',
      lessonId: 'lesson-one',
      status: 'completed',
    });

    const response = await DELETE(authorizedRequest(first.token));
    expect(response.status).toBe(204);
    await expect(readFile(join(dataDirectory, 'user-data', 'users', first.userId, 'data.json'), 'utf8'))
      .rejects.toMatchObject({ code: 'ENOENT' });

    const firstSession = await getSession(new Request('http://localhost/api/mobile/auth/session', {
      headers: { Authorization: `Bearer ${first.token}` },
    }));
    const secondSession = await getSession(new Request('http://localhost/api/mobile/auth/session', {
      headers: { Authorization: `Bearer ${second.token}` },
    }));
    expect(firstSession.status).toBe(401);
    expect(secondSession.status).toBe(200);
  });

  it('refuse une requête sans session valide', async () => {
    const response = await DELETE(authorizedRequest('invalid'));
    expect(response.status).toBe(401);
  });

  it('supprime un compte social uniquement avec une preuve liée au même provider/sub', async () => {
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'production');
    vi.stubEnv('SCIO_AUTH_MODE', 'social');
    const auth = scioAuthStoreFromEnvironment();
    const google = await auth.issueSocialSession('google', 'google-subject');
    const apple = await auth.issueSocialSession('apple', 'apple-subject');
    const challenge = await auth.issueReauthenticationChallenge(google.token, 'google');
    const consumed = await auth.consumeReauthenticationChallenge(google.token, 'google', challenge.state);
    const { proof } = await auth.issueReauthenticationProof(
      google.token,
      'google',
      'google-subject',
      consumed.userId,
    );

    const response = await DELETE(authorizedRequest(google.token, proof));

    expect(response.status).toBe(204);
    await expect(auth.verifySession(google.token)).resolves.toBeNull();
    await expect(auth.verifySession(apple.token)).resolves.toMatchObject({ user: apple.user });
  });

  it('refuse une suppression sociale sans preuve avant de supprimer les données', async () => {
    vi.stubEnv('SCIO_DEPLOYMENT_ENV', 'production');
    vi.stubEnv('SCIO_AUTH_MODE', 'social');
    const auth = scioAuthStoreFromEnvironment();
    const google = await auth.issueSocialSession('google', 'old-google-subject');
    await scioUserDataStoreFromEnvironment().applyProgress(google.user.id, {
      eventId: 'lesson:protected:completed',
      lessonId: 'lesson-protected',
      status: 'completed',
    });
    const response = await DELETE(authorizedRequest(google.token));

    expect(response.status).toBe(401);
    await expect(auth.verifySession(google.token)).resolves.toMatchObject({ user: google.user });
    await expect(readFile(join(dataDirectory, 'user-data', 'users', google.user.id, 'data.json'), 'utf8'))
      .resolves.toContain('lesson-protected');
  });
});
