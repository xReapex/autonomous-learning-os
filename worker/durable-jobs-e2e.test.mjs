import assert from 'node:assert/strict';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { createDurableJobRunner } from './durable-job-runner.mjs';
import { createDurableJobStore } from './durable-job-store.mjs';

const userId = 'usr_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const otherUserId = 'usr_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
const payload = { state: 's'.repeat(40), action: 'confirm' };
const output = {
  message: 'Parcours prêt',
  phase: 'proposal',
  progress: 100,
  document: { version: 1 },
  state: 'n'.repeat(40),
};

test('création, runner, redémarrage, lecture et acquittement restent durables et isolés', async () => {
  const root = await mkdtemp(join(tmpdir(), 'scio-jobs-e2e-'));
  const productionDirectory = join(root, 'production');
  const previewDirectory = join(root, 'preview');
  await Promise.all([
    mkdir(productionDirectory, { mode: 0o2770 }),
    mkdir(previewDirectory, { mode: 0o2770 }),
  ]);
  const production = createDurableJobStore({ directory: productionDirectory });
  const preview = createDurableJobStore({ directory: previewDirectory });

  const created = await production.create({
    userId,
    idempotencyKey: 'generation-device-e2e-0001',
    payload,
  });
  await preview.create({
    userId: otherUserId,
    idempotencyKey: 'generation-device-e2e-0002',
    payload,
  });

  const runner = createDurableJobRunner({
    store: production,
    execute: async (receivedPayload) => {
      assert.deepEqual(receivedPayload, payload);
      return output;
    },
    validateOutput: (value) => value?.phase === 'proposal' && value?.state === output.state,
    pollIntervalMs: 5,
  });
  await runner.start();
  assert.equal(await runner.runOnce(), true);
  await runner.stop();

  const restartedProduction = createDurableJobStore({ directory: productionDirectory });
  const completed = await restartedProduction.get(userId, created.job.id);
  assert.equal(completed.status, 'succeeded');
  assert.equal(completed.attempts, 1);
  assert.equal(typeof completed.startedAt, 'string');
  assert.equal(typeof completed.finishedAt, 'string');
  assert.deepEqual(completed.output, output);
  assert.equal(await preview.get(userId, created.job.id), null);
  assert.equal(await restartedProduction.acknowledge(userId, created.job.id), true);
  assert.equal(await restartedProduction.get(userId, created.job.id), null);
});
