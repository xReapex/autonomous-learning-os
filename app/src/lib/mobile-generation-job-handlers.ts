import { MAX_INTERVIEW_BODY_BYTES, validateInterviewRequest, type InterviewRequest } from './curriculum-interview';
import { bearerToken, errorResponse, noStoreJson } from './scio-auth';
import type { ScioSessionIdentity } from './scio-auth-store';

const JOB_ID = /^job_[a-f0-9]{32}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,200}$/;

export type PublicJob = {
  id: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  output: unknown | null;
  error: { category: string } | null;
};

export type StoredJob = PublicJob & {
  userId: string;
  payload?: unknown;
  idempotencyHash?: string;
  payloadHash?: string;
};

export type JobStore = {
  create(input: { userId: string; idempotencyKey: string; payload: InterviewRequest }): Promise<{ job: StoredJob; replayed: boolean }>;
  get(userId: string, jobId: string): Promise<StoredJob | null>;
  getByIdempotencyKey(userId: string, idempotencyKey: string): Promise<StoredJob | null>;
  cancel(userId: string, jobId: string): Promise<StoredJob | null>;
  acknowledge(userId: string, jobId: string): Promise<boolean>;
};

export type Dependencies = {
  auth: { verifySession(token: string): Promise<ScioSessionIdentity | null> };
  jobs: JobStore;
};

async function requireIdentity(request: Request, dependencies: Dependencies): Promise<ScioSessionIdentity | Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');
  return await dependencies.auth.verifySession(token) ?? errorResponse(401, 'session_unauthorized');
}

async function boundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('unsupported_media_type');
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_INTERVIEW_BODY_BYTES) throw new Error('body_too_large');
  if (!request.body) throw new Error('invalid_body');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_INTERVIEW_BODY_BYTES) {
      await reader.cancel();
      throw new Error('body_too_large');
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(merged)) as unknown; }
  catch { throw new Error('invalid_body'); }
}

function publicJob(job: StoredJob): PublicJob {
  return {
    id: job.id,
    status: job.status,
    attempts: job.attempts,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
    output: job.status === 'succeeded' ? job.output : null,
    error: job.status === 'failed' ? job.error : null,
  };
}

function storeError(error: unknown): Response {
  const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
  if (code === 'idempotency_conflict') return errorResponse(409, code);
  if (code === 'user_queue_full' || code === 'queue_full') return errorResponse(429, code);
  if (code === 'payload_too_large') return errorResponse(413, code);
  if (code === 'storage_busy') return errorResponse(503, 'job_store_unavailable');
  return errorResponse(500, 'job_store_failed');
}

export function createMobileGenerationJobHandlers(dependencies: Dependencies) {
  return {
    async create(request: Request): Promise<Response> {
      const identity = await requireIdentity(request, dependencies);
      if (identity instanceof Response) return identity;
      const idempotencyKey = request.headers.get('idempotency-key') ?? '';
      if (!IDEMPOTENCY_KEY.test(idempotencyKey)) return errorResponse(400, 'invalid_idempotency_key');
      let raw: unknown;
      try { raw = await boundedJson(request); }
      catch (error) {
        const code = error instanceof Error ? error.message : 'invalid_body';
        if (code === 'unsupported_media_type') return errorResponse(415, code);
        if (code === 'body_too_large') return errorResponse(413, code);
        return errorResponse(400, 'invalid_body');
      }
      const parsed = validateInterviewRequest(raw);
      if (!parsed.ok || !('action' in parsed.value) || parsed.value.action !== 'confirm' || !('state' in parsed.value)) {
        return errorResponse(400, 'invalid_generation_request');
      }
      try {
        const created = await dependencies.jobs.create({
          userId: identity.user.id,
          idempotencyKey,
          payload: parsed.value,
        });
        const headers = { Location: `/api/mobile/curriculum/jobs/${created.job.id}` };
        return noStoreJson({ job: publicJob(created.job) }, { status: created.replayed ? 200 : 202, headers });
      } catch (error) {
        return storeError(error);
      }
    },

    async get(request: Request, jobId: string): Promise<Response> {
      if (!JOB_ID.test(jobId)) return errorResponse(404, 'job_not_found');
      const identity = await requireIdentity(request, dependencies);
      if (identity instanceof Response) return identity;
      const job = await dependencies.jobs.get(identity.user.id, jobId);
      return job ? noStoreJson({ job: publicJob(job) }) : errorResponse(404, 'job_not_found');
    },

    async resolve(request: Request): Promise<Response> {
      const identity = await requireIdentity(request, dependencies);
      if (identity instanceof Response) return identity;
      const requestId = new URL(request.url).searchParams.get('requestId') ?? '';
      if (!IDEMPOTENCY_KEY.test(requestId)) return errorResponse(400, 'invalid_idempotency_key');
      const job = await dependencies.jobs.getByIdempotencyKey(identity.user.id, requestId);
      return job ? noStoreJson({ job: publicJob(job) }) : errorResponse(404, 'job_not_found');
    },

    async cancel(request: Request, jobId: string): Promise<Response> {
      if (!JOB_ID.test(jobId)) return errorResponse(404, 'job_not_found');
      const identity = await requireIdentity(request, dependencies);
      if (identity instanceof Response) return identity;
      const job = await dependencies.jobs.cancel(identity.user.id, jobId);
      return job ? noStoreJson({ job: publicJob(job) }) : errorResponse(404, 'job_not_found');
    },

    async acknowledge(request: Request, jobId: string): Promise<Response> {
      if (!JOB_ID.test(jobId)) return errorResponse(404, 'job_not_found');
      const identity = await requireIdentity(request, dependencies);
      if (identity instanceof Response) return identity;
      return await dependencies.jobs.acknowledge(identity.user.id, jobId)
        ? new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store, max-age=0' } })
        : errorResponse(404, 'job_not_found');
    },
  };
}
