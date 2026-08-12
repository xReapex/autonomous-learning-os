import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/app/create-course.tsx', import.meta.url), 'utf8');

test('create-course ne réserve pas une barre d’onglets ni deux marges hero sous le contenu', () => {
  assert.doesNotMatch(source, /paddingBottom:\s*layout\.tabBarHeight\s*\+\s*spacing\.hero\s*\*\s*2/);
  assert.match(source, /paddingBottom:\s*fluid\.sectionGap/);
});
