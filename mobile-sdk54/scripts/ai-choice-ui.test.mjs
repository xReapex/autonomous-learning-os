import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const screen = new URL('../src/app/create-course.tsx', import.meta.url);

test('l’entretien mobile propose les réponses IA avant la saisie libre', async () => {
  const source = await readFile(screen, 'utf8');
  assert.match(source, /response\.choices/);
  assert.match(source, /sendChoice/);
  assert.match(source, /engine\.otherAnswer/);
  assert.match(source, /customAnswer/);
});
