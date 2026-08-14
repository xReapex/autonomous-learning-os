import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');

test('les boutons avec icône gardent leur libellé sur l’axe visuel', async () => {
  const ui = await source('components/ui.tsx');
  assert.match(ui, /const\s+accessory\s*=\s*busy/);
  assert.match(ui, /styles\.buttonAccessory/);
  assert.match(ui, /buttonAccessory:\s*\{[\s\S]*?width:\s*20/);
  assert.match(ui, /accessory[\s\S]*?<Text[^>]*buttonLabel[\s\S]*?accessibilityElementsHidden[\s\S]*?buttonAccessory/);
});

test('les réponses utilisent des accessoires latéraux symétriques', async () => {
  const createCourse = await source('app/create-course.tsx');
  assert.match(createCourse, /styles\.choiceAccessory/);
  assert.match(createCourse, /width:\s*fluid\.controlSize\s*\*\s*0\.65/);
  assert.match(createCourse, /choiceAccessory:\s*\{[\s\S]*?alignItems:\s*'center'/);
});

test('le sujet reste lisible et peut revenir à la ligne', async () => {
  const createCourse = await source('app/create-course.tsx');
  assert.doesNotMatch(createCourse, /<Text\s+numberOfLines=\{1\}\s+style=\{styles\.topicText\}>/);
  assert.match(createCourse, /topicText:\s*\{[\s\S]*?lineHeight:/);
});
