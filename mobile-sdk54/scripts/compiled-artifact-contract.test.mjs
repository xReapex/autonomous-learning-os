import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import test from 'node:test';

const projectRoot = new URL('..', import.meta.url).pathname;
const forbidden = [
  'exchangeEngineSession',
  'engineTokenKey',
  'AccountSessionProvider',
  'Connect the engine',
  '/api/mobile/session',
  'EXPO_PUBLIC_DEMO_MODE',
];

async function filesInside(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesInside(path) : [path];
  }));
  return nested.flat();
}

test('checked-in dist artifacts never contain removed authentication flows', async () => {
  const entries = await readdir(projectRoot, { withFileTypes: true });
  const distDirectories = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('dist'))
    .map((entry) => join(projectRoot, entry.name));

  for (const directory of distDirectories) {
    for (const path of await filesInside(directory)) {
      const body = await readFile(path);
      for (const needle of forbidden) {
        assert.equal(body.includes(Buffer.from(needle)), false, `${path}: ${needle}`);
      }
    }
  }
});
