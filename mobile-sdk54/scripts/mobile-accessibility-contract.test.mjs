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

test('les libellés de boutons restent lisibles avec une grande police', async () => {
  const ui = await source('components/ui.tsx');
  assert.match(ui, /buttonLabel:\s*\{[\s\S]*?flexShrink:\s*1/);
  assert.match(ui, /buttonLabel:\s*\{[\s\S]*?textAlign:\s*'center'/);
});

test('la navigation réserve sa hauteur et intègre la zone système', async () => {
  const [tabs, taskBar] = await Promise.all([
    source('app/(tabs)/_layout.tsx'),
    source('components/course-generation-task-bar.tsx'),
  ]);
  assert.match(tabs, /useSafeAreaInsets\(\)/);
  assert.match(tabs, /height:\s*fluid\.tabBarHeight\s*\+\s*insets\.bottom/);
  assert.match(tabs, /paddingBottom:\s*insets\.bottom/);
  assert.doesNotMatch(tabs, /tabBarStyle:\s*\{[\s\S]*?position:\s*'absolute'/);
  assert.doesNotMatch(tabs, /tabBarStyle:\s*\{[\s\S]*?bottom:/);
  assert.match(taskBar, /bottom:\s*insets\.bottom\s*\+\s*\(inTabs\s*\?\s*fluid\.tabBarHeight\s*:\s*0\)\s*\+\s*fluid\.gutter\s*\*\s*0\.6/);
});

test('les changements de réponse et de mutation sont annoncés', async () => {
  const [reviews, courses] = await Promise.all([
    source('app/(tabs)/reviews.tsx'),
    source('app/(tabs)/courses.tsx'),
  ]);
  assert.match(reviews, /accessibilityLiveRegion="polite"/);
  assert.match(courses, /accessibilityLiveRegion="polite"/);
});

test('la suppression du sujet est confirmée et mène vers un état vide recréable', async () => {
  const [courses, profile, ui] = await Promise.all([
    source('app/(tabs)/courses.tsx'),
    source('app/(tabs)/profile.tsx'),
    source('components/ui.tsx'),
  ]);
  assert.match(courses, /requestDestructiveConfirmation\(\{/);
  assert.match(courses, /confirmLabel:\s*t\('curriculum\.remove'\)/);
  assert.match(courses, /variant="danger"/);
  assert.match(courses, /removeActiveCurriculum\(\)/);
  assert.match(ui, /status === 'empty'/);
  assert.match(ui, /router\.push\('\/create-course'/);
  assert.doesNotMatch(profile, /<DataGate>/);
  const provider = await source('providers/data-provider.tsx');
  assert.match(provider, /removeRemote:\s*\(\)\s*=>\s*deleteCurriculumRequest/);
  assert.match(provider, /removeCache:\s*async\s*\(\)\s*=>/);
  assert.match(provider, /commitLatest/);
});
