import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const ACTIVE = new Set(["queued", "running"]);
const TERMINAL = new Set(["succeeded", "failed", "cancelled"]);
const USER_ID = /^usr_[a-f0-9]{32}$/;
const JOB_ID = /^job_[a-f0-9]{32}$/;
const IDEMPOTENCY_KEY = /^[A-Za-z0-9._:-]{16,200}$/;

export class DurableJobStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = "DurableJobStoreError";
    this.code = code;
  }
}

const bytes = (value) => Buffer.byteLength(JSON.stringify(value));
const digest = (value) => createHash("sha256").update(value).digest("hex");
const isPlain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
const clone = (value) => structuredClone(value);

function validStoredJob(job) {
  return isPlain(job)
    && JOB_ID.test(job.id)
    && USER_ID.test(job.userId)
    && typeof job.idempotencyHash === "string"
    && typeof job.payloadHash === "string"
    && isPlain(job.payload)
    && [...ACTIVE, ...TERMINAL].includes(job.status)
    && Number.isSafeInteger(job.attempts)
    && job.attempts >= 0
    && typeof job.createdAt === "string"
    && typeof job.updatedAt === "string";
}

function parseStore(raw) {
  let value;
  try { value = JSON.parse(raw); } catch { throw new DurableJobStoreError("storage_invalid"); }
  if (isPlain(value) && value.version === 1 && Array.isArray(value.jobs) && value.jobs.every(validStoredJob)) {
    return { version: 2, jobs: value.jobs, deletedUserHashes: [] };
  }
  if (
    !isPlain(value) || value.version !== 2 || !Array.isArray(value.jobs) ||
    !value.jobs.every(validStoredJob) || !Array.isArray(value.deletedUserHashes) ||
    !value.deletedUserHashes.every((hash) => typeof hash === "string" && /^[a-f0-9]{64}$/.test(hash))
  ) {
    throw new DurableJobStoreError("storage_invalid");
  }
  return value;
}

function processAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error?.code !== "ESRCH"; }
}

async function recoverLock(lockPath, malformedStaleMs) {
  let observed;
  try { observed = await readFile(lockPath, "utf8"); }
  catch (error) { return error?.code === "ENOENT"; }
  let owner = null;
  try {
    const candidate = JSON.parse(observed);
    if (typeof candidate?.token === "string" && Number.isSafeInteger(candidate.pid) && candidate.pid > 0) owner = candidate;
  } catch { /* malformed locks fail closed while fresh */ }
  if (owner ? processAlive(owner.pid) : Date.now() - (await stat(lockPath)).mtimeMs < malformedStaleMs) return false;
  if (await readFile(lockPath, "utf8").catch(() => "") !== observed) return false;
  await unlink(lockPath).catch((error) => { if (error?.code !== "ENOENT") throw error; });
  return true;
}

async function withLock(lockPath, operation, timeoutMs = 5_000) {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o2770 });
  const token = randomUUID();
  const owner = JSON.stringify({ token, pid: process.pid });
  const deadline = Date.now() + timeoutMs;
  let handle;
  while (!handle) {
    try {
      handle = await open(lockPath, "wx", 0o660);
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      if (await recoverLock(lockPath, 30_000)) continue;
      if (Date.now() >= deadline) throw new DurableJobStoreError("storage_busy");
      await delay(10);
    }
  }
  try {
    await handle.writeFile(owner, "utf8");
    await handle.sync();
    return await operation();
  } finally {
    await handle.close().catch(() => undefined);
    if (await readFile(lockPath, "utf8").catch(() => "") === owner) await unlink(lockPath).catch(() => undefined);
  }
}

async function atomicWrite(file, value) {
  await mkdir(dirname(file), { recursive: true, mode: 0o2770 });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o660);
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, "utf8");
    await handle.sync();
  } finally {
    await handle.close();
  }
  try { await rename(temporary, file); }
  catch (error) { await unlink(temporary).catch(() => undefined); throw error; }
}

export function createDurableJobStore({
  directory,
  maxActivePerUser = 2,
  maxTotalJobs = 1_000,
  maxPayloadBytes = 64 * 1024,
  maxOutputBytes = 2 * 1024 * 1024,
  maxAttempts = 3,
  terminalRetentionMs = 7 * 24 * 60 * 60 * 1000,
  now = () => new Date(),
} = {}) {
  if (typeof directory !== "string" || !directory) throw new DurableJobStoreError("invalid_configuration");
  const file = join(directory, "jobs.json");
  const lock = `${file}.lock`;

  function pruneTerminal(state) {
    const cutoff = now().getTime() - terminalRetentionMs;
    const previous = state.jobs.length;
    state.jobs = state.jobs.filter((job) => !(
      TERMINAL.has(job.status)
      && typeof job.finishedAt === "string"
      && Date.parse(job.finishedAt) <= cutoff
    ));
    return state.jobs.length !== previous;
  }

  async function read() {
    try { return parseStore(await readFile(file, "utf8")); }
    catch (error) {
      if (error?.code === "ENOENT") return { version: 2, jobs: [], deletedUserHashes: [] };
      throw error;
    }
  }

  async function mutate(operation) {
    return withLock(lock, async () => {
      const state = await read();
      const pruned = pruneTerminal(state);
      const result = await operation(state);
      if (pruned || result?.changed) await atomicWrite(file, state);
      return result?.value;
    });
  }

  return {
    async create({ userId, idempotencyKey, payload }) {
      if (!USER_ID.test(userId) || !IDEMPOTENCY_KEY.test(idempotencyKey) || !isPlain(payload)) {
        throw new DurableJobStoreError("invalid_job");
      }
      if (bytes(payload) > maxPayloadBytes) throw new DurableJobStoreError("payload_too_large");
      const idempotencyHash = digest(`${userId}\0${idempotencyKey}`);
      const payloadHash = digest(JSON.stringify(payload));
      return mutate(async (state) => {
        if (state.deletedUserHashes.includes(digest(userId))) throw new DurableJobStoreError("user_deleted");
        const existing = state.jobs.find((job) => job.idempotencyHash === idempotencyHash);
        if (existing) {
          if (existing.payloadHash !== payloadHash) throw new DurableJobStoreError("idempotency_conflict");
          return { changed: false, value: { job: clone(existing), replayed: true } };
        }
        if (state.jobs.filter((job) => job.userId === userId && ACTIVE.has(job.status)).length >= maxActivePerUser) {
          throw new DurableJobStoreError("user_queue_full");
        }
        if (state.jobs.length >= maxTotalJobs) throw new DurableJobStoreError("queue_full");
        const timestamp = now().toISOString();
        const job = {
          id: `job_${randomUUID().replaceAll("-", "")}`,
          userId,
          idempotencyHash,
          payloadHash,
          payload: clone(payload),
          status: "queued",
          attempts: 0,
          createdAt: timestamp,
          updatedAt: timestamp,
          startedAt: null,
          finishedAt: null,
          output: null,
          error: null,
        };
        state.jobs.push(job);
        return { changed: true, value: { job: clone(job), replayed: false } };
      });
    },

    async get(userId, jobId) {
      if (!USER_ID.test(userId) || !JOB_ID.test(jobId)) return null;
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId && candidate.userId === userId);
        return { changed: false, value: job ? clone(job) : null };
      });
    },

    async getByIdempotencyKey(userId, idempotencyKey) {
      if (!USER_ID.test(userId) || !IDEMPOTENCY_KEY.test(idempotencyKey)) return null;
      const idempotencyHash = digest(`${userId}\0${idempotencyKey}`);
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.idempotencyHash === idempotencyHash);
        return { changed: false, value: job ? clone(job) : null };
      });
    },

    async getById(jobId) {
      if (!JOB_ID.test(jobId)) return null;
      const state = await read();
      const job = state.jobs.find((candidate) => candidate.id === jobId);
      return job ? clone(job) : null;
    },

    async claimNext() {
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.status === "queued");
        if (!job) return { changed: false, value: null };
        const timestamp = now().toISOString();
        job.status = "running";
        job.attempts += 1;
        job.startedAt = timestamp;
        job.updatedAt = timestamp;
        return { changed: true, value: clone(job) };
      });
    },

    async recoverInterrupted() {
      return mutate(async (state) => {
        let recovered = 0;
        let changed = false;
        const timestamp = now().toISOString();
        for (const job of state.jobs) {
          if (job.status !== "running") continue;
          changed = true;
          if (job.attempts >= maxAttempts) {
            job.status = "failed";
            job.startedAt = null;
            job.finishedAt = timestamp;
            job.updatedAt = timestamp;
            job.error = { category: "restart_limit" };
            continue;
          }
          job.status = "queued";
          job.startedAt = null;
          job.updatedAt = timestamp;
          recovered += 1;
        }
        return { changed, value: recovered };
      });
    },

    async cancel(userId, jobId) {
      if (!USER_ID.test(userId) || !JOB_ID.test(jobId)) return null;
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId && candidate.userId === userId);
        if (!job) return { changed: false, value: null };
        if (!ACTIVE.has(job.status)) return { changed: false, value: clone(job) };
        const timestamp = now().toISOString();
        job.status = "cancelled";
        job.updatedAt = timestamp;
        job.finishedAt = timestamp;
        job.error = null;
        return { changed: true, value: clone(job) };
      });
    },

    async succeed(jobId, output) {
      if (!JOB_ID.test(jobId) || !isPlain(output)) throw new DurableJobStoreError("invalid_job");
      if (bytes(output) > maxOutputBytes) throw new DurableJobStoreError("output_too_large");
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId);
        if (!job || job.status !== "running") return { changed: false, value: false };
        const timestamp = now().toISOString();
        job.status = "succeeded";
        job.output = clone(output);
        job.error = null;
        job.updatedAt = timestamp;
        job.finishedAt = timestamp;
        return { changed: true, value: true };
      });
    },

    async fail(jobId, category) {
      if (!JOB_ID.test(jobId) || !/^[a-z][a-z0-9_]{0,63}$/.test(category)) throw new DurableJobStoreError("invalid_job");
      return mutate(async (state) => {
        const job = state.jobs.find((candidate) => candidate.id === jobId);
        if (!job || job.status !== "running") return { changed: false, value: false };
        const timestamp = now().toISOString();
        job.status = "failed";
        job.output = null;
        job.error = { category };
        job.updatedAt = timestamp;
        job.finishedAt = timestamp;
        return { changed: true, value: true };
      });
    },

    async acknowledge(userId, jobId) {
      if (!USER_ID.test(userId) || !JOB_ID.test(jobId)) return false;
      return mutate(async (state) => {
        const index = state.jobs.findIndex((job) => job.id === jobId && job.userId === userId && TERMINAL.has(job.status));
        if (index < 0) return { changed: false, value: false };
        state.jobs.splice(index, 1);
        return { changed: true, value: true };
      });
    },

    async deleteUserJobs(userId) {
      if (!USER_ID.test(userId)) return 0;
      return mutate(async (state) => {
        const previous = state.jobs.length;
        state.jobs = state.jobs.filter((job) => job.userId !== userId);
        const deleted = previous - state.jobs.length;
        const userHash = digest(userId);
        const tombstoneAdded = !state.deletedUserHashes.includes(userHash);
        if (tombstoneAdded) state.deletedUserHashes.push(userHash);
        return { changed: deleted > 0 || tombstoneAdded, value: deleted };
      });
    },
  };
}
