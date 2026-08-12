import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  new URL('../src/app/(tabs)/index.tsx', import.meta.url),
  new URL('../src/app/(tabs)/_layout.tsx', import.meta.url),
  new URL('../src/components/auth-screen.tsx', import.meta.url),
];

test('les surfaces refondues dérivent leur géométrie du viewport', async () => {
  const [home, tabs, auth] = await Promise.all(files.map((file) => readFile(file, 'utf8')));
  for (const source of [home, tabs, auth]) {
    assert.match(source, /useFluidLayout/);
    assert.doesNotMatch(source, /minHeight:\s*(?:1[0-9]{2}|[2-9][0-9]{2})/);
    assert.doesNotMatch(source, /maxWidth:\s*[0-9]+/);
  }
  assert.doesNotMatch(home, /(?:width|height):\s*(?:38|44|52)/);
  assert.doesNotMatch(tabs, /height:\s*layout\.tabBarHeight/);
  assert.match(home, /aspectRatio:\s*1/);
  assert.match(tabs, /tabBarShowLabel:\s*!fluid\.compact/);
});
