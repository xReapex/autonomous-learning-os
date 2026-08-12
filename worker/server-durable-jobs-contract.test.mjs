import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const base = new URL('.', import.meta.url);
const server = await readFile(new URL('./server.mjs', base), 'utf8');
const store = await readFile(new URL('./durable-job-store.mjs', base), 'utf8');
const workerUnit = await readFile(new URL('../deploy/learningos-codex.service', base), 'utf8');
const appUnit = await readFile(new URL('../deploy/autonomous-learning-os.service', base), 'utf8');
const previewUnit = await readFile(new URL('../deploy/scio-preview.service', base), 'utf8');
const productionEnvironment = await readFile(new URL('../deploy/runtime.env.example', base), 'utf8');
const previewEnvironment = await readFile(new URL('../deploy/scio-preview.env.example', base), 'utf8');
const workerEnvironment = await readFile(new URL('../deploy/codex-worker.env.example', base), 'utf8');
const provisioning = await readFile(new URL('../deploy/configure-generation-job-environments.py', base), 'utf8');

for (const signal of ['SIGTERM', 'SIGINT']) {
  test(`le worker arrête les runners sur ${signal}`, () => {
    assert.match(server, new RegExp(`process\\.once\\(\\"${signal}\\"`));
  });
}

test('les runners durables démarrent après la disponibilité de la socket', () => {
  const listen = server.indexOf('server.listen(socketPath');
  const start = server.indexOf('Promise.all(generationJobRunners.map((runner) => runner.start');
  assert.ok(listen >= 0 && start > listen);
  assert.match(server, /background:\s*true/);
  assert.match(server, /createInterviewJobExecutor/);
});

test('production et preview utilisent deux stores consommés par deux runners isolés', () => {
  assert.match(productionEnvironment, /SCIO_GENERATION_JOBS_DIR=\/var\/lib\/scio-generation-jobs\/production/);
  assert.match(previewEnvironment, /SCIO_GENERATION_JOBS_DIR=\/var\/lib\/scio-generation-jobs\/preview/);
  assert.match(workerEnvironment, /SCIO_PRODUCTION_GENERATION_JOBS_DIR=\/var\/lib\/scio-generation-jobs\/production/);
  assert.match(workerEnvironment, /SCIO_PREVIEW_GENERATION_JOBS_DIR=\/var\/lib\/scio-generation-jobs\/preview/);
  assert.match(server, /SCIO_PRODUCTION_GENERATION_JOBS_DIR/);
  assert.match(server, /SCIO_PREVIEW_GENERATION_JOBS_DIR/);
  assert.match(server, /Promise\.all\(generationJobRunners\.map\(\(runner\) => runner\.stop\(\)\)\)/);
});

test('les stores séparés restent privés aux services nécessaires', () => {
  assert.doesNotMatch(store, /\bmkdir\(/);
  assert.match(provisioning, /SCIO_PRODUCTION_GENERATION_JOBS_DIR/);
  assert.match(store, /open\(lockPath,\s*\"wx\",\s*0o660\)/);
  assert.match(store, /open\(temporary,\s*\"wx\",\s*0o660\)/);
  for (const unit of [workerUnit, appUnit, previewUnit]) assert.match(unit, /UMask=0007/);
  assert.match(workerUnit, /ReadWritePaths=.*\/var\/lib\/scio-generation-jobs\/production.*\/var\/lib\/scio-generation-jobs\/preview/);
  assert.match(appUnit, /ReadWritePaths=.*\/var\/lib\/scio-generation-jobs\/production/);
  assert.doesNotMatch(appUnit, /ReadWritePaths=.*scio-generation-jobs\/preview/);
  assert.match(previewUnit, /ReadWritePaths=.*\/var\/lib\/scio-generation-jobs\/preview/);
  assert.doesNotMatch(previewUnit, /ReadWritePaths=.*scio-generation-jobs\/production/);
});
