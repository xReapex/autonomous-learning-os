import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/app/create-course.tsx', import.meta.url), 'utf8');

test('create-course réserve uniquement sa marge fluide et la hauteur réelle du dock', () => {
  assert.doesNotMatch(source, /paddingBottom:\s*layout\.tabBarHeight\s*\+\s*spacing\.hero\s*\*\s*2/);
  assert.match(source, /useOverlayInset/);
  assert.match(source, /const\s*\{\s*overlayInset\s*\}\s*=\s*useOverlayInset\(\)/);
  assert.match(source, /paddingBottom:\s*fluid\.sectionGap\s*\+\s*overlayInset/);
  assert.match(source, /style=\{\[styles\.cardTitle,\s*styles\.center\]\}>\{t\('engine\.activated'\)\}/);
});
