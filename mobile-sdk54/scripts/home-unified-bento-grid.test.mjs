import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('l’accueil hiérarchise un parcours dominant, une bande métrique et une création secondaire', () => {
  assert.match(source, /styles\.courseCard/);
  assert.match(source, /styles\.metricsBand/);
  assert.match(source, /styles\.createRow/);
  assert.match(source, /minHeight:\s*fluid\.controlSize,\s*padding:\s*fluid\.cardPadding/);
  assert.doesNotMatch(source, /styles\.createBlock/);
  assert.doesNotMatch(source, /<BentoGrid|<BentoTile/);
  assert.match(source, /metric:\s*\{\s*flex:\s*1,\s*minWidth:\s*0/);
});
