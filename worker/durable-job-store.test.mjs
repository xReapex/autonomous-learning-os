import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createDurableJobStore, DurableJobStoreError } from "./durable-job-store.mjs";

const userA = "usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const userB = "usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const payload = { state: "s".repeat(40), action: "confirm" };

async function makeStore(options = {}) {
  const directory = await mkdtemp(join(tmpdir(), "scio-jobs-"));
  return { directory, store: createDurableJobStore({ directory, ...options }) };
}

test("exige un répertoire provisionné au lieu de le créer dans le sandbox", async () => {
  const parent = await mkdtemp(join(tmpdir(), "scio-jobs-parent-"));
  const directory = join(parent, "missing");
  const store = createDurableJobStore({ directory });
  await assert.rejects(
    store.create({ userId: userA, idempotencyKey: "generation-device-0000", payload }),
    (error) => error?.code === "ENOENT",
  );
  await rm(parent, { recursive: true, force: true });
});

test("crée un job idempotent sans conserver la clé en clair", async () => {
  const { directory, store } = await makeStore();
  const first = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  const replay = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });

  assert.equal(first.replayed, false);
  assert.equal(replay.replayed, true);
  assert.equal(replay.job.id, first.job.id);
  assert.equal(first.job.status, "queued");
  const raw = await readFile(join(directory, "jobs.json"), "utf8");
  assert.equal(raw.includes("generation-device-0001"), false);
});

test("refuse la réutilisation d'une clé avec un payload différent", async () => {
  const { store } = await makeStore();
  await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  await assert.rejects(
    store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload: { locale: "fr" } }),
    (error) => error instanceof DurableJobStoreError && error.code === "idempotency_conflict",
  );
});

test("isole la lecture par utilisateur", async () => {
  const { store } = await makeStore();
  const { job } = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  assert.equal((await store.get(userA, job.id))?.id, job.id);
  assert.equal(await store.get(userB, job.id), null);
});

test("retrouve un job par clé d'idempotence sans exposer ni nécessiter le payload", async () => {
  const { store } = await makeStore();
  const { job } = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  assert.equal((await store.getByIdempotencyKey(userA, "generation-device-0001"))?.id, job.id);
  assert.equal(await store.getByIdempotencyKey(userB, "generation-device-0001"), null);
});

test("borne le nombre de jobs actifs par utilisateur sous concurrence", async () => {
  const { store } = await makeStore({ maxActivePerUser: 1 });
  const results = await Promise.allSettled([
    store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload }),
    store.create({ userId: userA, idempotencyKey: "generation-device-0002", payload }),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected" && result.reason?.code === "user_queue_full").length, 1);
});

test("reprend après restart un job interrompu sans doubler la tentative", async () => {
  const { directory, store } = await makeStore();
  const { job } = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  const claimed = await store.claimNext();
  assert.equal(claimed?.status, "running");
  assert.equal(claimed?.attempts, 1);

  const restarted = createDurableJobStore({ directory });
  assert.equal(await restarted.recoverInterrupted(), 1);
  const resumed = await restarted.claimNext();
  assert.equal(resumed?.id, job.id);
  assert.equal(resumed?.attempts, 2);
});

test("borne les reprises après crash et termine en échec technique", async () => {
  const { directory, store } = await makeStore({ maxAttempts: 2 });
  const { job } = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  await store.claimNext();
  await store.recoverInterrupted();
  await store.claimNext();

  const restarted = createDurableJobStore({ directory, maxAttempts: 2 });
  assert.equal(await restarted.recoverInterrupted(), 0);
  assert.equal((await restarted.get(userA, job.id))?.status, "failed");
  assert.deepEqual((await restarted.get(userA, job.id))?.error, { category: "restart_limit" });
});

test("annule queued/running et interdit toute réussite tardive", async () => {
  const { store } = await makeStore();
  const first = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  await store.claimNext();
  const cancelled = await store.cancel(userA, first.job.id);
  assert.equal(cancelled?.status, "cancelled");
  assert.equal(await store.succeed(first.job.id, { phase: "proposal" }), false);
  assert.equal((await store.get(userA, first.job.id))?.status, "cancelled");
});

test("valide et borne identifiants, payloads et sorties avant persistance", async () => {
  const { store } = await makeStore({ maxPayloadBytes: 128, maxOutputBytes: 128 });
  await assert.rejects(
    store.create({ userId: "../shared", idempotencyKey: "generation-device-0001", payload }),
    (error) => error instanceof DurableJobStoreError && error.code === "invalid_job",
  );
  await assert.rejects(
    store.create({ userId: userA, idempotencyKey: "short", payload }),
    (error) => error instanceof DurableJobStoreError && error.code === "invalid_job",
  );
  await assert.rejects(
    store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload: { text: "x".repeat(200) } }),
    (error) => error instanceof DurableJobStoreError && error.code === "payload_too_large",
  );

  const created = await store.create({ userId: userA, idempotencyKey: "generation-device-0002", payload });
  await store.claimNext();
  await assert.rejects(store.succeed(created.job.id, { text: "x".repeat(200) }), /output_too_large/);
  assert.equal((await store.get(userA, created.job.id))?.status, "running");
});

test("acquitte un job terminal appartenant à l'utilisateur et efface son payload", async () => {
  const { directory, store } = await makeStore();
  const { job } = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  await store.claimNext();
  await store.succeed(job.id, { phase: "proposal" });
  assert.equal(await store.acknowledge(userB, job.id), false);
  assert.equal(await store.acknowledge(userA, job.id), true);
  assert.equal(await store.get(userA, job.id), null);
  assert.equal((await readFile(join(directory, "jobs.json"), "utf8")).includes("\"state\""), false);
});

test("purge tous les jobs d'un compte supprimé sans toucher aux autres", async () => {
  const { store } = await makeStore();
  const first = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  const second = await store.create({ userId: userB, idempotencyKey: "generation-device-0002", payload });
  assert.equal(await store.deleteUserJobs(userA), 1);
  assert.equal(await store.get(userA, first.job.id), null);
  assert.equal((await store.get(userB, second.job.id))?.id, second.job.id);
  await assert.rejects(
    store.create({ userId: userA, idempotencyKey: "generation-device-late", payload }),
    (error) => error instanceof DurableJobStoreError && error.code === "user_deleted",
  );
});

test("élague les jobs terminaux au-delà de la rétention maximale", async () => {
  let current = new Date("2026-08-01T00:00:00.000Z");
  const { store } = await makeStore({ now: () => current, terminalRetentionMs: 7 * 24 * 60 * 60 * 1000 });
  const old = await store.create({ userId: userA, idempotencyKey: "generation-device-0001", payload });
  await store.claimNext();
  await store.succeed(old.job.id, { phase: "proposal" });
  current = new Date("2026-08-09T00:00:00.000Z");
  const fresh = await store.create({ userId: userB, idempotencyKey: "generation-device-0002", payload });
  assert.equal(await store.get(userA, old.job.id), null);
  assert.equal((await store.get(userB, fresh.job.id))?.id, fresh.job.id);
});
