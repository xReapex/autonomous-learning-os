import test from "node:test";
import assert from "node:assert/strict";

import { createDurableJobRunner } from "./durable-job-runner.mjs";

const job = { id: "job_11111111111111111111111111111111", payload: { state: "s".repeat(40), action: "confirm" } };

function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}

test("reprend les running au démarrage puis valide et persiste une réussite", async () => {
  const calls = [];
  const store = {
    recoverInterrupted: async () => { calls.push("recover"); return 1; },
    claimNext: async () => { calls.push("claim"); return calls.filter((value) => value === "claim").length === 1 ? job : null; },
    getById: async () => ({ ...job, status: "running" }),
    succeed: async (_id, output) => { calls.push(["succeed", output]); return true; },
    fail: async () => { throw new Error("unexpected fail"); },
  };
  const execute = async () => ({ phase: "proposal", message: "Prêt", choices: [], progress: 100, document: {}, state: "n".repeat(40) });
  const runner = createDurableJobRunner({ store, execute, validateOutput: () => true, idleDelayMs: 1 });

  await runner.start();
  await runner.runOnce();
  await runner.stop();

  assert.equal(calls[0], "recover");
  assert.equal(calls[1], "claim");
  assert.equal(calls[2][0], "succeed");
});

test("échoue de manière bornée sur une sortie invalide sans la persister", async () => {
  let claims = 0;
  let succeeded = false;
  let failed;
  const store = {
    recoverInterrupted: async () => 0,
    claimNext: async () => claims++ === 0 ? job : null,
    getById: async () => ({ ...job, status: "running" }),
    succeed: async () => { succeeded = true; return true; },
    fail: async (_id, category) => { failed = category; return true; },
  };
  const runner = createDurableJobRunner({ store, execute: async () => ({ nope: true }), validateOutput: () => false });
  await runner.start();
  await runner.runOnce();
  await runner.stop();
  assert.equal(succeeded, false);
  assert.equal(failed, "invalid_output");
  assert.equal(claims, 1);
});

test("annulation pendant l'exécution avorte et bloque la réussite tardive", async () => {
  const gate = deferred();
  let signal;
  let succeeded = false;
  let failed = false;
  const store = {
    recoverInterrupted: async () => 0,
    claimNext: async () => job,
    getById: async () => ({ ...job, status: "cancelled" }),
    succeed: async () => { succeeded = true; return true; },
    fail: async () => { failed = true; return true; },
  };
  const runner = createDurableJobRunner({
    store,
    execute: async (_payload, receivedSignal) => { signal = receivedSignal; await gate.promise; return { phase: "proposal" }; },
    validateOutput: () => true,
  });
  await runner.start();
  const running = runner.runOnce();
  await new Promise((resolve) => setImmediate(resolve));
  runner.cancel(job.id);
  assert.equal(signal.aborted, true);
  gate.resolve();
  await running;
  await runner.stop();
  assert.equal(succeeded, false);
  assert.equal(failed, false);
});

test("détecte une annulation persistée par un autre processus", async () => {
  const gate = deferred();
  let reads = 0;
  let observedAbort = false;
  const store = {
    recoverInterrupted: async () => 0,
    claimNext: async () => job,
    getById: async () => ({ ...job, status: reads++ === 0 ? "running" : "cancelled" }),
    succeed: async () => { throw new Error("unexpected succeed"); },
    fail: async () => { throw new Error("unexpected fail"); },
  };
  const runner = createDurableJobRunner({
    store,
    execute: async (_payload, signal) => {
      await new Promise((resolve) => signal.addEventListener("abort", resolve, { once: true }));
      observedAbort = true;
      gate.resolve();
      throw new Error("aborted");
    },
    validateOutput: () => true,
    cancellationPollMs: 1,
  });
  await runner.start();
  const running = runner.runOnce();
  await gate.promise;
  await running;
  await runner.stop();
  assert.equal(observedAbort, true);
});

test("stop avorte le travail actif et attend sa terminaison", async () => {
  const gate = deferred();
  let signal;
  const store = {
    recoverInterrupted: async () => 0,
    claimNext: async () => job,
    getById: async () => ({ ...job, status: "running" }),
    succeed: async () => false,
    fail: async () => false,
  };
  const runner = createDurableJobRunner({
    store,
    execute: async (_payload, receivedSignal) => { signal = receivedSignal; await gate.promise; throw new Error("aborted"); },
    validateOutput: () => true,
  });
  await runner.start();
  const running = runner.runOnce();
  await new Promise((resolve) => setImmediate(resolve));
  const stopping = runner.stop();
  assert.equal(signal.aborted, true);
  gate.resolve();
  await Promise.all([running, stopping]);
});
