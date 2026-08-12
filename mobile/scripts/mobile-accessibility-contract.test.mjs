import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
}

test('le contenu essentiel reste lisible avec Dynamic Type', async () => {
  const [home, dock, reviews] = await Promise.all([
    source('app/(tabs)/index.tsx'),
    source('components/course-generation-task-bar.tsx'),
    source('app/(tabs)/reviews.tsx'),
  ]);
  assert.doesNotMatch(home, /numberOfLines=/);
  assert.doesNotMatch(dock, /numberOfLines=/);
  assert.match(reviews, /actions: \{ flexDirection: 'column'/);
});

test('les changements de réponse et de mutation sont annoncés', async () => {
  const [reviews, courses] = await Promise.all([
    source('app/(tabs)/reviews.tsx'),
    source('app/(tabs)/courses.tsx'),
  ]);
  assert.match(reviews, /accessibilityLiveRegion="polite"/);
  assert.match(courses, /accessibilityLiveRegion="polite"/);
});
