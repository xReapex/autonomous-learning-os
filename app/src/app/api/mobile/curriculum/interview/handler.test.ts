import { afterEach, describe, expect, it, vi } from 'vitest';

import { createMobileInterviewRouteHandler, mobileBearerAuthorized } from './handler';

const sessionToken = 'scio_' + 't'.repeat(48);
const identity = {
  user: { id: 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', displayName: 'A', provider: 'development' as const },
  entitlement: 'demo' as const,
  expiresAt: '2099-01-01T00:00:00.000Z',
};

function request(authorization?: string, site?: string) {
  return new Request('https://learning.example/api/mobile/curriculum/interview', {
    method: 'POST',
    headers: {
      ...(authorization ? { authorization } : {}),
      ...(site ? { 'sec-fetch-site': site } : {}),
    },
  });
}

const verifier = () => ({
  verifySession: vi.fn(async (token: string) => token === sessionToken ? identity : null),
});

describe('frontière session SCIO de l’entretien mobile', () => {
  afterEach(() => {
    delete process.env.CODEX_INTERVIEW_WORKER_SECRET;
  });

  it('accepte uniquement un Bearer résolu par le store SCIO', async () => {
    const auth = verifier();
    await expect(mobileBearerAuthorized(request(`Bearer ${sessionToken}`), auth)).resolves.toBe(true);
    await expect(mobileBearerAuthorized(request(`Bearer ${sessionToken}x`), auth)).resolves.toBe(false);
    await expect(mobileBearerAuthorized(request(`Basic ${sessionToken}`), auth)).resolves.toBe(false);
    await expect(mobileBearerAuthorized(request(), auth)).resolves.toBe(false);
  });

  it('rejette cross-site avant de consulter le store de session', async () => {
    const auth = verifier();
    await expect(mobileBearerAuthorized(request(`Bearer ${sessionToken}`, 'cross-site'), auth)).resolves.toBe(false);
    expect(auth.verifySession).not.toHaveBeenCalled();
  });

  it('ne contacte le worker qu’après une session SCIO valide', async () => {
    process.env.CODEX_INTERVIEW_WORKER_SECRET = 'w'.repeat(48);
    const worker = vi.fn(async () => Response.json({
      phase: 'question',
      message: 'Quel sujet précis veux-tu apprendre ?',
      choices: ['Une langue', 'Une compétence pratique', 'Un sujet théorique'],
      progress: 10,
      document: null,
      state: 's'.repeat(40),
    }));
    const auth = verifier();
    const POST = createMobileInterviewRouteHandler(worker, undefined, undefined, auth);
    const body = JSON.stringify({ locale: 'fr' });

    const denied = await POST(new Request('https://learning.example/api/mobile/curriculum/interview', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
    }));
    expect(denied.status).toBe(401);
    expect(worker).not.toHaveBeenCalled();

    const allowed = await POST(new Request('https://learning.example/api/mobile/curriculum/interview', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${sessionToken}` },
      body,
    }));
    expect(allowed.status).toBe(200);
    expect((await allowed.json()).phase).toBe('question');
    expect(worker).toHaveBeenCalledOnce();
  });
});
