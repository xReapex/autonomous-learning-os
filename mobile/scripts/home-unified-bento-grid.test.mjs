import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('l’accueil hiérarchise un parcours dominant, une bande métrique et une création éditoriale', () => {
  assert.match(source, /styles\.courseCard/);
  assert.match(source, /styles\.metricsBand/);
  assert.match(source, /styles\.createBlock/);
  assert.match(source, /gap:\s*fluid\.sectionGap,\s*padding:\s*fluid\.cardPadding/);
  assert.doesNotMatch(source, /<BentoGrid|<BentoTile/);
  assert.match(source, /metric:\s*\{\s*flex:\s*1,\s*minWidth:\s*0/);
});
