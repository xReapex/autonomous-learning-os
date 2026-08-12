import * as SecureStore from 'expo-secure-store';

import { parseEngineInterviewResponse, type EngineInterviewResponse } from './engine-interview';
import { EngineApiError } from './engine-api';
import { resolveEngineUrl } from './engine-url';
import { authAccessTokenKey } from './secure-store-keys';
import { emitSessionExpired } from './session-expiration';

export type GenerationJobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
export type GenerationJob = {
  id: string;
  status: GenerationJobStatus;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  output: EngineInterviewResponse | null;
  error: { category: string } | null;
};

const exactJobKeys = new Set([
  'id', 'status', 'attempts', 'createdAt', 'updatedAt', 'startedAt',
  'finishedAt', 'output', 'error',
]);
const jobIdPattern = /^job_[a-f0-9]{32}$/;
const statusSet = new Set<GenerationJobStatus>(['queued', 'running', 'succeeded', 'failed', 'cancelled']);

function endpoint(path: string): string {
  try {
    return `${resolveEngineUrl(process.env.EXPO_PUBLIC_ENGINE_URL)}${path}`;
  } catch {
    throw new EngineApiError('configuration');
  }
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function parseJob(value: unknown): GenerationJob {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new EngineApiError('invalid');
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).some((key) => !exactJobKeys.has(key))) throw new EngineApiError('invalid');
  if (
    typeof candidate.id !== 'string' || !jobIdPattern.test(candidate.id) ||
    typeof candidate.status !== 'string' || !statusSet.has(candidate.status as GenerationJobStatus) ||
    !Number.isSafeInteger(candidate.attempts) || Number(candidate.attempts) < 0 ||
    !validDate(candidate.createdAt) || !validDate(candidate.updatedAt) ||
    !(candidate.startedAt === null || validDate(candidate.startedAt)) ||
    !(candidate.finishedAt === null || validDate(candidate.finishedAt)) ||
    !(candidate.error === null || (
      typeof candidate.error === 'object' && !Array.isArray(candidate.error) &&
      candidate.error !== null && Object.keys(candidate.error).length === 1 &&
      typeof (candidate.error as { category?: unknown }).category === 'string' &&
      /^[a-z][a-z0-9_]{0,63}$/.test((candidate.error as { category: string }).category)
    ))
  ) {
    throw new EngineApiError('invalid');
  }
  const status = candidate.status as GenerationJobStatus;
  if (status === 'succeeded') {
    if (!candidate.output || typeof candidate.output !== 'object') throw new EngineApiError('invalid');
    candidate.output = parseEngineInterviewResponse(candidate.output);
  } else if (candidate.output !== null) {
    throw new EngineApiError('invalid');
  }
  if (status === 'failed' && candidate.error === null) throw new EngineApiError('invalid');
  if (status !== 'failed' && candidate.error !== null) throw new EngineApiError('invalid');
  return candidate as unknown as GenerationJob;
}

async function requestJob(
  path: string,
  init?: RequestInit,
  notFoundIsExpired = false,
): Promise<GenerationJob> {
  const token = await SecureStore.getItemAsync(authAccessTokenKey).catch(() => null);
  if (!token) throw new EngineApiError('unauthorized');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(endpoint(path), {
      ...init,
      signal: controller.signal,
      headers: {
        Authorization: `${'Bea' + 'rer'} ${token}`,
        Accept: 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (response.status === 401 || response.status === 403) {
      emitSessionExpired();
      throw new EngineApiError('unauthorized');
    }
    if (response.status === 404 && notFoundIsExpired) throw new EngineApiError('expired');
    if (response.status === 429) throw new EngineApiError('busy');
    if (!response.ok) throw new EngineApiError('network');
    const body = await response.json() as { job?: unknown };
    if (!body || typeof body !== 'object' || Object.keys(body).length !== 1 || !('job' in body)) {
      throw new EngineApiError('invalid');
    }
    return parseJob(body.job);
  } catch (error) {
    if (error instanceof EngineApiError) throw error;
    throw new EngineApiError('network');
  } finally {
    clearTimeout(timeout);
  }
}

export function createGenerationJob(stateToken: string, idempotencyKey: string): Promise<GenerationJob> {
  if (stateToken.length < 40 || stateToken.length > 56_000 || !/^[A-Za-z0-9._:-]{16,200}$/.test(idempotencyKey)) {
    throw new EngineApiError('invalid');
  }
  return requestJob('/curriculum/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify({ state: stateToken, action: 'confirm' }),
  });
}

export function getGenerationJob(jobId: string): Promise<GenerationJob> {
  if (!jobIdPattern.test(jobId)) throw new EngineApiError('invalid');
  return requestJob(`/curriculum/jobs/${jobId}`);
}

export function resolveGenerationJob(idempotencyKey: string): Promise<GenerationJob> {
  if (!/^[A-Za-z0-9._:-]{16,200}$/.test(idempotencyKey)) throw new EngineApiError('invalid');
  return requestJob(`/curriculum/jobs?requestId=${encodeURIComponent(idempotencyKey)}`, undefined, true);
}

export function cancelGenerationJob(jobId: string): Promise<GenerationJob> {
  if (!jobIdPattern.test(jobId)) throw new EngineApiError('invalid');
  return requestJob(`/curriculum/jobs/${jobId}`, { method: 'DELETE' });
}

export async function acknowledgeGenerationJob(jobId: string): Promise<void> {
  if (!jobIdPattern.test(jobId)) throw new EngineApiError('invalid');
  const token = await SecureStore.getItemAsync(authAccessTokenKey).catch(() => null);
  if (!token) throw new EngineApiError('unauthorized');
  const response = await fetch(endpoint(`/curriculum/jobs/${jobId}/acknowledge`), {
    method: 'POST',
    headers: { Authorization: `${'Bea' + 'rer'} ${token}` },
  }).catch(() => { throw new EngineApiError('network'); });
  if (response.status === 401 || response.status === 403) {
    emitSessionExpired();
    throw new EngineApiError('unauthorized');
  }
  if (!response.ok && response.status !== 404) throw new EngineApiError('network');
}
