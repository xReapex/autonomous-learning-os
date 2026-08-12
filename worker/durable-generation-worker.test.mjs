import test from "node:test";
import assert from "node:assert/strict";

import { createInterviewJobExecutor, validPublicInterviewResponse } from "./durable-generation-worker.mjs";

const payload = { state: "s".repeat(40), action: "confirm" };
const proposal = {
  phase: "proposal",
  message: "Le curriculum est prêt.",
  choices: [],
  progress: 100,
  document: { version: 1 },
  state: "n".repeat(40),
};

test("l'exécuteur transmet uniquement le payload validé et accepte une sortie publique validée", async () => {
  let received;
  const execute = createInterviewJobExecutor({
    workerClient: async (body) => { received = body; return Response.json(proposal); },
    secret: "w".repeat(32),
    validateOutput: (value) => value?.phase === "proposal" && value?.document?.version === 1,
  });
  assert.deepEqual(await execute(payload, new AbortController().signal), proposal);
  assert.deepEqual(received, payload);
});

test("rejette avant transport un payload qui n'est pas une confirmation", async () => {
  let called = false;
  const execute = createInterviewJobExecutor({ workerClient: async () => { called = true; return Response.json(proposal); } });
  await assert.rejects(execute({ locale: "fr" }, new AbortController().signal), /invalid_payload/);
  assert.equal(called, false);
});

test("rejette statuts, médias, tailles et sorties invalides sans exposer leur contenu", async () => {
  for (const response of [
    new Response("failed", { status: 502, headers: { "content-type": "application/json" } }),
    new Response(JSON.stringify(proposal), { headers: { "content-type": "text/plain" } }),
    new Response("x".repeat(70_000), { headers: { "content-type": "application/json" } }),
    Response.json({ ...proposal, phase: "question" }),
  ]) {
    const execute = createInterviewJobExecutor({ workerClient: async () => response, secret: "w".repeat(32), validateOutput: () => false });
    await assert.rejects(execute(payload, new AbortController().signal), /worker_status|worker_media|worker_body|invalid_output/);
  }
});

test("le validateur public exige l'enveloppe exacte et une proposition finale", () => {
  const validateDocument = (document) => document?.version === 1;
  assert.equal(validPublicInterviewResponse(proposal, validateDocument), true);
  assert.equal(validPublicInterviewResponse({ ...proposal, extra: true }, validateDocument), false);
  assert.equal(validPublicInterviewResponse({ ...proposal, phase: "confirmation", progress: 90, document: null }, validateDocument), false);
  assert.equal(validPublicInterviewResponse({ ...proposal, state: "short" }, validateDocument), false);
});
