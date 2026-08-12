import { request as httpRequest } from 'node:http';

import type { SocialProvider } from './scio-auth-store';

type WorkerIdentity = { subject: string };

function validIdentity(value: unknown): value is WorkerIdentity {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<WorkerIdentity>;
  return typeof candidate.subject === 'string' && candidate.subject.length >= 1 && candidate.subject.length <= 255
    && Object.keys(candidate).length === 1;
}

export function verifySocialIdentityViaWorker(input: {
  provider: SocialProvider;
  idToken: string;
  expectedNonce: string;
  audience: string;
}): Promise<WorkerIdentity> {
  const secret = process.env.CODEX_INTERVIEW_WORKER_SECRET;
  if (!secret || secret.length < 32) return Promise.reject(new Error('social_identity_unavailable'));
  const payload = Buffer.from(JSON.stringify(input));
  if (payload.length > 20_000) return Promise.reject(new Error('social_identity_invalid'));
  const socketPath = process.env.CODEX_INTERVIEW_WORKER_SOCKET ?? '/run/learningos-codex/worker.sock';

  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (error?: Error, identity?: WorkerIdentity) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error); else resolve(identity!);
    };
    const request = httpRequest({
      socketPath,
      path: '/social/verify',
      method: 'POST',
      headers: {
        authorization: `Bearer ${secret}`,
        'content-type': 'application/json',
        accept: 'application/json',
        'content-length': payload.length,
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > 8_192) {
          response.destroy();
          request.destroy();
          settle(new Error('social_identity_unavailable'));
        } else chunks.push(chunk);
      });
      response.once('end', () => {
        let body: unknown;
        try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch {
          settle(new Error('social_identity_unavailable'));
          return;
        }
        if (response.statusCode === 401) return settle(new Error('social_identity_invalid'));
        if (response.statusCode !== 200 || !validIdentity(body)) return settle(new Error('social_identity_unavailable'));
        settle(undefined, body);
      });
      response.once('aborted', () => settle(new Error('social_identity_unavailable')));
      response.once('error', () => settle(new Error('social_identity_unavailable')));
    });
    const timer = setTimeout(() => {
      request.destroy();
      settle(new Error('social_identity_unavailable'));
    }, 8_000);
    request.once('error', () => settle(new Error('social_identity_unavailable')));
    request.end(payload);
  });
}
