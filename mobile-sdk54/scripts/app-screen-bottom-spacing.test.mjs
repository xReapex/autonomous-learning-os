import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');

test('AppScreen ne cumule pas barre d’onglets et marges hero sous chaque écran', () => {
  assert.doesNotMatch(source, /paddingBottom:\s*layout\.tabBarHeight\s*\+\s*spacing\.hero\s*\*\s*2/);
  assert.match(source, /paddingBottom:\s*fluid\.sectionGap\s*\+\s*overlayInset/);
});
