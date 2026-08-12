import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/providers/data-provider.tsx', import.meta.url), 'utf8');
const activation = source.match(/const activateGeneratedCurriculum[\s\S]*?\n  }, \[[^\]]*\]\);/)?.[0] ?? '';

test('l’activation relit les données autoritatives après remplacement du curriculum', () => {
  assert.match(activation, /await replaceCurriculum/);
  assert.match(activation, /await fetchAuthoritativeData/);
  assert.doesNotMatch(activation, /state\.data|reconcileProgress/);
});
