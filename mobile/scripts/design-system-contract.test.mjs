import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  new URL('../src/components/ui.tsx', import.meta.url),
  new URL('../src/app/(tabs)/index.tsx', import.meta.url),
];

const bentoFiles = [
  new URL('../src/components/ui.tsx', import.meta.url),
  new URL('../src/app/(tabs)/index.tsx', import.meta.url),
  new URL('../src/app/(tabs)/profile.tsx', import.meta.url),
];

const brandFiles = [
  new URL('../src/constants/theme.ts', import.meta.url),
  new URL('../src/components/auth-screen.tsx', import.meta.url),
  new URL('../src/app/create-course.tsx', import.meta.url),
];

test('SCIO uses solid visual hierarchy without decorative gradients', async () => {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.equal(source.includes('LinearGradient'), false, `${file.pathname} still uses a gradient`);
  }
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(packageJson.dependencies['expo-linear-gradient'], undefined);
});

test('SCIO combines an editorial home hierarchy with reusable profile bento primitives', async () => {
  const [ui, home, profile] = await Promise.all(bentoFiles.map((file) => readFile(file, 'utf8')));
  assert.match(ui, /export function BentoGrid/);
  assert.match(ui, /export function BentoTile/);
  assert.match(ui, /useReducedMotion/);
  assert.match(home, /styles\.courseCard/);
  assert.match(home, /styles\.metricsBand/);
  assert.doesNotMatch(home, /<BentoGrid|<BentoTile/);
  assert.match(profile, /<BentoGrid/);
  assert.match(profile, /<BentoTile/);
});

test('SCIO wordmarks use the serif brand family', async () => {
  const [theme, auth, creation] = await Promise.all(brandFiles.map((file) => readFile(file, 'utf8')));
  assert.match(theme, /brand:/);
  assert.match(auth, /fontFamily: typography\.brand/);
  assert.match(creation, /fontFamily: typography\.brand/);
});
