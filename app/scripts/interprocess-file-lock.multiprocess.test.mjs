import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const directory = await mkdtemp(join(tmpdir(), 'scio-lock-process-'));
const appDirectory = join(dirname(fileURLToPath(import.meta.url)), '..');
const modulePath = join(directory, 'interprocess-file-lock.js');
await new Promise((resolve, reject) => {
  const compiler = spawn(process.execPath, [
    join(appDirectory, 'node_modules/typescript/bin/tsc'),
    join(appDirectory, 'src/lib/interprocess-file-lock.ts'),
    '--target', 'ES2022',
    '--module', 'commonjs',
    '--moduleResolution', 'node',
    '--types', 'node',
    '--esModuleInterop',
    '--skipLibCheck',
    '--outDir', directory,
  ], { cwd: appDirectory, stdio: ['ignore', 'ignore', 'pipe'] });
  let error = '';
  compiler.stderr.on('data', (chunk) => { error += chunk; });
  compiler.on('error', reject);
  compiler.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`tsc failed ${code}: ${error}`)));
});
const lockPath = join(directory, 'store.lock');

function child(mode, timeout) {
  const code = `
    const { withInterprocessFileLock } = require(${JSON.stringify(modulePath)});
    withInterprocessFileLock(${JSON.stringify(lockPath)}, async () => {
      process.stdout.write('LOCKED\\n');
      if (${JSON.stringify(mode)} === 'hold') await new Promise(() => {
        process.stdin.resume();
        process.stdin.once('data', () => { throw new Error('simulated_crash'); });
      });
      return 'ok';
    }, { timeoutMs: ${timeout} }).then(() => {
      process.stdout.write('DONE\\n'); process.exitCode = 0;
    }).catch((error) => {
      process.stdout.write(error.name + ':' + error.message + '\\n'); process.exitCode = 2;
    });
  `;
  return spawn(process.execPath, ['-e', code], { stdio: ['pipe', 'pipe', 'pipe'] });
}

function outputUntil(processHandle, marker) {
  return new Promise((resolve, reject) => {
    let output = '';
    processHandle.stdout.on('data', (chunk) => {
      output += chunk;
      if (output.includes(marker)) resolve(output);
    });
    processHandle.on('error', reject);
    processHandle.on('exit', (code) => {
      if (!output.includes(marker)) reject(new Error(`child exited ${code}: ${output}`));
    });
  });
}

test('un vrai processus vivant garde le verrou, puis son arrêt brutal permet la récupération', async () => {
  const owner = child('hold', 2_000);
  await outputUntil(owner, 'LOCKED');
  const ownerMetadata = JSON.parse(await readFile(lockPath, 'utf8'));
  assert.equal(ownerMetadata.pid, owner.pid);

  const contender = child('once', 80);
  const rejected = await outputUntil(contender, 'InterprocessLockError');
  assert.match(rejected, /interprocess_lock_timeout/);

  owner.stdin.write('crash');
  await new Promise((resolve) => owner.once('exit', resolve));

  const recovery = child('once', 500);
  const recovered = await outputUntil(recovery, 'DONE');
  assert.match(recovered, /LOCKED/);
});
