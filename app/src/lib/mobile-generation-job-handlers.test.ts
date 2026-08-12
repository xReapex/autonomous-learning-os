import { describe, expect, it, vi } from 'vitest';

import {
  createMobileGenerationJobHandlers,
  type Dependencies,
  type JobStore,
  type StoredJob,
} from './mobile-generation-job-handlers';

const tokenA = `scio_${'a'.repeat(48)}`;
const tokenB = `scio_${'b'.repeat(48)}`;
const userA = 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const userB = 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const state = 's'.repeat(40);
const baseJob: StoredJob = {
  id: 'job_11111111111111111111111111111111',
  userId: userA,
  status: 'queued',
  attempts: 0,
  createdAt: '2026-08-12T00:00:00.000Z',
  updatedAt: '2026-08-12T00:00:00.000Z',
  startedAt: null,
  finishedAt: null,
  output: null,
  error: null,
};

function dependencies() {
  const jobs = {
    create: vi.fn(async (): ReturnType<JobStore['create']> => ({ job: baseJob, replayed: false })),
    get: vi.fn(async (userId: string, jobId: string): ReturnType<JobStore['get']> => userId === userA && jobId === baseJob.id ? baseJob : null),
    getByIdempotencyKey: vi.fn(async (userId: string, key: string): ReturnType<JobStore['getByIdempotencyKey']> => userId === userA && key === 'generation-device-0001' ? baseJob : null),
    cancel: vi.fn(async (userId: string, jobId: string): ReturnType<JobStore['cancel']> => userId === userA && jobId === baseJob.id ? { ...baseJob, status: 'cancelled' } : null),
    acknowledge: vi.fn(async (userId: string, jobId: string): ReturnType<JobStore['acknowledge']> => userId === userA && jobId === baseJob.id),
  } satisfies JobStore;
  const auth = {
    verifySession: vi.fn(async (token: string) => token === tokenA
      ? { user: { id: userA, displayName: 'A', provider: 'development' as const }, entitlement: 'demo' as const, expiresAt: '2099-01-01T00:00:00.000Z' }
      : token === tokenB
        ? { user: { id: userB, displayName: 'B', provider: 'development' as const }, entitlement: 'demo' as const, expiresAt: '2099-01-01T00:00:00.000Z' }
        : null),
  };
  return { auth, jobs } satisfies Dependencies;
}

function createRequest(body: unknown, token = tokenA, key = 'generation-device-0001') {
  return new Request('https://learning.example/api/mobile/curriculum/jobs', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'idempotency-key': key },
    body: JSON.stringify(body),
  });
}

function itemRequest(method: string, token = tokenA) {
  return new Request(`https://learning.example/api/mobile/curriculum/jobs/${baseJob.id}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });
}

describe('API mobile des générations durables', () => {
  it('crée uniquement une confirmation validée et retourne un suivi asynchrone', async () => {
    const deps = dependencies();
    const handlers = createMobileGenerationJobHandlers(deps);
    const response = await handlers.create(createRequest({ state, action: 'confirm' }));

    expect(response.status).toBe(202);
    expect(response.headers.get('location')).toBe(`/api/mobile/curriculum/jobs/${baseJob.id}`);
    expect(await response.json()).toEqual({ job: expect.objectContaining({ id: baseJob.id, status: 'queued' }) });
    expect(deps.jobs.create).toHaveBeenCalledWith({
      userId: userA,
      idempotencyKey: 'generation-device-0001',
      payload: { state, action: 'confirm' },
    });
  });

  it('refuse avant stockage les sessions, clés, médias, tailles et payloads invalides', async () => {
    const deps = dependencies();
    const handlers = createMobileGenerationJobHandlers(deps);
    expect((await handlers.create(createRequest({ state, action: 'confirm' }, 'invalid'))).status).toBe(401);
    expect((await handlers.create(new Request('https://learning.example/api/mobile/curriculum/jobs', {
      method: 'POST', headers: { authorization: `Bearer ${tokenA}`, 'idempotency-key': 'generation-device-0001' }, body: '{}',
    }))).status).toBe(415);
    expect((await handlers.create(createRequest({ locale: 'fr' }))).status).toBe(400);
    expect((await handlers.create(createRequest({ state: 'x'.repeat(70_000), action: 'confirm' }))).status).toBe(413);
    expect((await handlers.create(createRequest({ state, action: 'confirm' }, tokenA, 'short'))).status).toBe(400);
    expect(deps.jobs.create).toHaveBeenCalledTimes(0);
  });

  it('retourne le même job lors d’un replay idempotent', async () => {
    const deps = dependencies();
    deps.jobs.create.mockResolvedValue({ job: { ...baseJob, status: 'running' }, replayed: true });
    const response = await createMobileGenerationJobHandlers(deps).create(createRequest({ state, action: 'confirm' }));
    expect(response.status).toBe(200);
    expect((await response.json()).job.status).toBe('running');
  });

  it('résout après redémarrage le job créé par une clé idempotente de la même session', async () => {
    const deps = dependencies();
    const response = await createMobileGenerationJobHandlers(deps).resolve(
      new Request('https://learning.example/api/mobile/curriculum/jobs?requestId=generation-device-0001', {
        headers: { authorization: `${'Bea' + 'rer'} ${tokenA}` },
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).job.id).toBe(baseJob.id);
    expect(deps.jobs.getByIdempotencyKey).toHaveBeenCalledWith(userA, 'generation-device-0001');
  });

  it('traduit les limites et conflits du store sans contenu sensible', async () => {
    const deps = dependencies();
    deps.jobs.create.mockRejectedValue(Object.assign(new Error('idempotency_conflict'), { code: 'idempotency_conflict' }));
    const response = await createMobileGenerationJobHandlers(deps).create(createRequest({ state, action: 'confirm' }));
    expect(response.status).toBe(409);
    expect(JSON.stringify(await response.json())).not.toContain(state);
  });

  it('isole get et cancel par utilisateur et ne renvoie jamais le payload stocké', async () => {
    const deps = dependencies();
    const handlers = createMobileGenerationJobHandlers(deps);
    const own = await handlers.get(itemRequest('GET'), baseJob.id);
    expect(own.status).toBe(200);
    const ownBody = await own.json();
    expect(ownBody.job.id).toBe(baseJob.id);
    expect(ownBody.job).not.toHaveProperty('payload');
    expect(ownBody.job).not.toHaveProperty('userId');

    expect((await handlers.get(itemRequest('GET', tokenB), baseJob.id)).status).toBe(404);
    expect((await handlers.cancel(itemRequest('DELETE', tokenB), baseJob.id)).status).toBe(404);
    expect(deps.jobs.cancel).toHaveBeenCalledWith(userB, baseJob.id);
  });

  it('refuse un identifiant de job hors contrat sans consulter le store', async () => {
    const deps = dependencies();
    const response = await createMobileGenerationJobHandlers(deps).get(itemRequest('GET'), '../shared');
    expect(response.status).toBe(404);
    expect(deps.jobs.get).not.toHaveBeenCalled();
  });

  it('acquitte uniquement un job terminal appartenant à la session', async () => {
    const deps = dependencies();
    const handlers = createMobileGenerationJobHandlers(deps);
    expect((await handlers.acknowledge(itemRequest('POST'), baseJob.id)).status).toBe(204);
    expect(deps.jobs.acknowledge).toHaveBeenCalledWith(userA, baseJob.id);
    expect((await handlers.acknowledge(itemRequest('POST', tokenB), baseJob.id)).status).toBe(404);
  });
});
