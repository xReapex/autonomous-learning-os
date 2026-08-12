import { join } from 'node:path';

import { createScioAuthStore } from './scio-auth-store';

export function scioAuthStoreFromEnvironment() {
  const configuredDirectory = process.env.SCIO_AUTH_DATA_DIR?.trim();
  const baseDirectory = process.env.LEARNING_DATA_DIR?.trim() || join(process.cwd(), '.data');
  return createScioAuthStore({
    dataDirectory: configuredDirectory || join(baseDirectory, 'auth'),
    environment: process.env.NODE_ENV,
    deploymentEnvironment: process.env.SCIO_DEPLOYMENT_ENV?.trim() || 'production',
    authMode: process.env.SCIO_AUTH_MODE,
    sessionTtlMs: process.env.SCIO_DEPLOYMENT_ENV?.trim() === 'preview'
      ? 24 * 60 * 60 * 1_000
      : undefined,
    maxDevelopmentUsers: Number(process.env.SCIO_PREVIEW_MAX_USERS || '25'),
  });
}

export function noStoreJson(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'no-store, max-age=0');
  headers.set('Pragma', 'no-cache');
  return Response.json(body, { ...init, headers });
}

export function errorResponse(status: number, code: string): Response {
  return noStoreJson({ error: { code } }, { status });
}

export function bearerToken(request: Request): string | null {
  const authorization = request.headers.get('authorization');
  const match = /^Bearer\s+([^\s]+)$/i.exec(authorization ?? '');
  return match?.[1] ?? null;
}
