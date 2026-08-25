import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (path) => readFile(new URL(`../src/${path}`, import.meta.url), 'utf8');
const manifest = () => readFile(new URL('../app.json', import.meta.url), 'utf8');

const styleBlock = (sourceText, name) => {
  const marker = `  ${name}: {`;
  const start = sourceText.indexOf(marker);
  assert.notEqual(start, -1, `style ${name} absent`);
  const bodyStart = start + marker.length;
  const end = sourceText.indexOf('\n  },', bodyStart);
  assert.notEqual(end, -1, `style ${name} non borné`);
  return sourceText.slice(bodyStart, end);
};

test('les états sans contenu partagent une scène éditoriale accessible', async () => {
  const [ui, exercises, reviews] = await Promise.all([
    source('components/ui.tsx'),
    source('app/(tabs)/exercises.tsx'),
    source('app/(tabs)/reviews.tsx'),
  ]);
  assert.match(ui, /export function StateScene/);
  assert.match(ui, /accessibilityRole="header"/);
  assert.match(ui, /tone="danger"/);
  assert.match(ui, /accessibilityLiveRegion=\{alert \? 'assertive' : live \? 'polite' : undefined\}/);
  assert.match(ui, /status === 'empty'[\s\S]*<StateScene/);
  assert.match(exercises, /<StateScene/);
  assert.match(reviews, /<StateScene/);
  assert.match(exercises, /<StateScene[\s\S]*?\blive\b/);
  assert.match(reviews, /<StateScene[\s\S]*?\blive\b/);
  assert.match(exercises, /<AppScreen contentContainerStyle=\{styles\.stateScreen\}>/);
  assert.match(reviews, /<AppScreen contentContainerStyle=\{styles\.stateScreen\}>/);
});

test('l’accueil garde le parcours courant comme seul héros visuel', async () => {
  const home = await source('app/(tabs)/index.tsx');
  assert.match(home, /styles\.courseCard/);
  assert.match(home, /styles\.createRow/);
  assert.doesNotMatch(home, /styles\.createBlock/);
  assert.doesNotMatch(home, /backgroundColor:\s*palette\.primary,[\s\S]*createCopy/);
});

test('la suppression du cursus vient après les modules', async () => {
  const courses = await source('app/(tabs)/courses.tsx');
  const modules = courses.indexOf('data.curriculum.course.modules.map');
  const dangerAction = courses.indexOf('variant="danger"');
  assert.ok(modules >= 0 && dangerAction > modules, 'l’action destructive précède encore le contenu principal');
});

test('la navigation adapte la barre basse en rail sans masquer les libellés par largeur', async () => {
  const [tabs, fluid, taskBar, rewardToast] = await Promise.all([
    source('app/(tabs)/_layout.tsx'),
    source('lib/fluid-layout.ts'),
    source('components/course-generation-task-bar.tsx'),
    source('components/reward-toast.tsx'),
  ]);
  assert.match(fluid, /tabBarWidth:\s*number/);
  assert.match(fluid, /shortViewport:\s*boolean/);
  assert.match(fluid, /shortViewport:\s*height\s*<\s*620/);
  assert.match(await source('lib/i18n.ts'), /'tabs\.homeShort':\s*'Début'/);
  assert.match(await source('lib/i18n.ts'), /'tabs\.exercisesShort':\s*'Quiz'/);
  assert.match(await source('lib/i18n.ts'), /'tabs\.reviewsShort':\s*'Cartes'/);
  assert.match(await source('lib/i18n.ts'), /'a11y\.tabWithShort':\s*'\{\{short\}\}, ouvrir l’onglet \{\{tab\}\}'/);
  assert.match(tabs, /tabBarPosition:\s*fluid\.tablet\s*\?\s*'left'\s*:\s*'bottom'/);
  assert.match(tabs, /tabBarLabelPosition:\s*'below-icon'/);
  assert.match(tabs, /tabBarShowLabel:\s*true/);
  assert.match(tabs, /fluid\.largeText\s*&&\s*tab\.shortTitleKey/);
  assert.match(tabs, /const accessibilityTitle = fluid\.largeText && tab\.shortTitleKey/);
  assert.match(tabs, /tabBarAccessibilityLabel:\s*accessibilityTitle/);
  assert.match(tabs, /title:\s*visualTitle/);
  assert.match(tabs, /shortTitleKey:\s*'tabs\.homeShort'/);
  assert.doesNotMatch(tabs, /tabBarShowLabel:\s*!fluid\.compact/);
  assert.match(taskBar, /fluid\.tablet\s*\?\s*fluid\.tabBarWidth/);
  assert.match(taskBar, /!fluid\.tablet\s*\?\s*fluid\.tabBarHeight/);
  assert.match(rewardToast, /left:\s*fluid\.gutter\s*\+\s*\(fluid\.tablet\s*\?\s*fluid\.tabBarWidth\s*:\s*0\)/);
  assert.match(await source('components/ui.tsx'), /fluid\.largeText\s*&&\s*fluid\.shortViewport\s*&&\s*styles\.stateContainerShort/);
  assert.match(await source('components/ui.tsx'), /const condensed = fluid\.largeText && fluid\.shortViewport/);
  assert.match(await source('components/ui.tsx'), /!condensed \? \(/);
  assert.match(await source('components/ui.tsx'), /condensed && styles\.stateSceneCondensed/);
});

test('l’accès SCIO utilise une composition éditoriale visible plutôt qu’une carte flottante générique', async () => {
  const [auth, i18n] = await Promise.all([
    source('components/auth-screen.tsx'),
    source('lib/i18n.ts'),
  ]);

  const heroPanel = styleBlock(auth, 'heroPanel');
  const accessPanel = styleBlock(auth, 'accessPanel');
  const largeTopline = styleBlock(auth, 'sheetToplineLargeText');

  assert.match(auth, /styles\.heroPanel/);
  assert.match(auth, /styles\.editorialSpine/);
  assert.match(auth, /styles\.accessPanel/);
  assert.match(auth, /!fluid\.compact \? \(/);
  assert.match(auth, /fluid\.compact && styles\.sheetToplineLargeText/);
  assert.match(auth, /t\('auth\.accessEyebrow'\)/);
  assert.match(i18n, /'auth\.accessEyebrow':\s*'ACCÈS'/);
  assert.match(i18n, /'auth\.accessEyebrow':\s*'ACCESS'/);
  assert.match(heroPanel, /backgroundColor:\s*palette\.ink/);
  assert.doesNotMatch(heroPanel, /overflow:\s*'hidden'/);
  assert.match(accessPanel, /borderLeftWidth:\s*4/);
  assert.match(largeTopline, /flexDirection:\s*'column'/);
  assert.match(largeTopline, /alignItems:\s*'flex-start'/);
  assert.doesNotMatch(auth, /styles\.actionSheet/);
});

test('le manifeste autorise les fenêtres et orientations adaptatives sur tablette', async () => {
  const appJson = await manifest();
  assert.match(appJson, /"orientation":\s*"default"/);
  assert.match(appJson, /"supportsTablet":\s*true/);
});

test('le CTA initial promet une personnalisation et non une création déjà terminée', async () => {
  const i18n = await source('lib/i18n.ts');
  assert.match(i18n, /'engine\.start':\s*'Commencer la personnalisation'/);
  assert.match(i18n, /'engine\.start':\s*'Start personalizing'/);
  assert.doesNotMatch(i18n, /'engine\.start':\s*'(Créer mon parcours|Create my learning path)'/);
});
