import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('le générateur par défaut déduit les thèmes via le helper canonique défini', async () => {
  const source = await readFile(new URL('./server.mjs', import.meta.url), 'utf8');
  assert.match(source, /questionTopicFromMessage/);
  assert.doesNotMatch(source, /questionTemplates\(/);
});