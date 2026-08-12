import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const taskBar = fs.readFileSync(new URL('../src/components/course-generation-task-bar.tsx', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../src/components/ui.tsx', import.meta.url), 'utf8');
const home = fs.readFileSync(new URL('../src/app/(tabs)/index.tsx', import.meta.url), 'utf8');

test('le dock publie sa hauteur et les écrans réservent cet inset', () => {
  assert.match(taskBar, /onLayout=/);
  assert.match(taskBar, /setOverlayInset/);
  assert.match(ui, /useOverlayInset/);
  assert.match(ui, /paddingBottom:\s*fluid\.sectionGap\s*\+\s*overlayInset/);
});

test('le dock passe en disposition verticale avec une grande police', () => {
  assert.match(taskBar, /useFluidLayout/);
  assert.match(taskBar, /fluid\.largeText/);
  assert.match(taskBar, /taskLargeText/);
});

test('le badge de progression utilise un couple opaque accessible', () => {
  assert.match(home, /percentPill:[\s\S]*backgroundColor:\s*palette\.white/);
  assert.match(home, /percent:\s*\{\s*color:\s*palette\.primaryDark/);
});
