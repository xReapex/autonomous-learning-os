import assert from 'node:assert/strict';
import { existsSync, globSync, readFileSync } from 'node:fs';
import test from 'node:test';
import { inflateSync } from 'node:zlib';

const projectRoot = new URL('..', import.meta.url);
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const sourceFiles = globSync('src/**/*.{ts,tsx}', { cwd: projectRoot });
const readSource = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

function inspectPng(relativePath) {
  const data = readFileSync(new URL(`../${relativePath}`, import.meta.url));
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  const width = data.readUInt32BE(16);
  const height = data.readUInt32BE(20);
  const bitDepth = data[24];
  const colorType = data[25];
  let offset = 8;
  const idat = [];
  while (offset < data.length) {
    const length = data.readUInt32BE(offset);
    const type = data.subarray(offset + 4, offset + 8).toString();
    if (type === 'IDAT') idat.push(data.subarray(offset + 8, offset + 8 + length));
    offset += length + 12;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const cornerAlpha = colorType === 6 ? raw[4] : 255;
  return { width, height, bitDepth, colorType, cornerAlpha };
}

test('application source uses Lucide instead of MaterialCommunityIcons', () => {
  assert.ok(packageJson.dependencies['lucide-react-native']);
  const offenders = sourceFiles.filter((path) => readSource(path).includes('MaterialCommunityIcons'));
  assert.deepEqual(offenders, []);
});

test('all product icons use the semantic AppIcon adapter', () => {
  const offenders = sourceFiles.filter(
    (path) => path !== 'src/components/app-icon.tsx' && readSource(path).includes("from 'lucide-react-native'"),
  );
  assert.deepEqual(offenders, []);

  const adapter = readSource('src/components/app-icon.tsx');
  for (const forbidden of ['Sparkles', 'WandSparkles', 'Lightbulb', 'Database', 'FlaskConical']) {
    assert.doesNotMatch(adapter, new RegExp(`\\b${forbidden}\\b`));
  }
});

test('icon names are semantic and do not preserve Material aliases', () => {
  const allSource = sourceFiles.map(readSource).join('\n');
  for (const forbidden of [
    '-outline',
    'home-variant',
    'account-circle',
    'star-four-points',
    'chart-arc',
    'gesture-tap',
    'content-save',
  ]) {
    assert.doesNotMatch(allSource, new RegExp(forbidden));
  }
});

test('approved SCIO assets replace the old dotted S mark', () => {
  const mark = readSource('src/components/scio-mark.tsx');
  assert.doesNotMatch(mark, /\bCircle\b|palette\.accent|M43 15H27/);
  assert.match(mark, /accessibilityLabel="SCIO"/);

  const appJson = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
  assert.equal(appJson.expo.slug, 'scio');
  assert.equal(appJson.expo.icon, './assets/brand/icon-v5.png');
  assert.equal(appJson.expo.userInterfaceStyle, 'light');
  assert.equal(appJson.expo.backgroundColor, '#F5F7F6');
  assert.equal(appJson.expo.android.adaptiveIcon.backgroundColor, '#0B5D57');
  assert.equal(appJson.expo.android.adaptiveIcon.foregroundImage, './assets/brand/adaptive-foreground-v5.png');
  assert.equal(appJson.expo.android.adaptiveIcon.monochromeImage, './assets/brand/adaptive-monochrome-v5.png');
  const splashPlugin = appJson.expo.plugins.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
  );
  assert.ok(splashPlugin, 'expo-splash-screen plugin must be configured');
  assert.equal(splashPlugin[1].backgroundColor, '#F5F7F6');
  assert.equal(splashPlugin[1].image, './assets/brand/splash-v5.png');
  assert.equal(appJson.expo.splash, undefined);
  const assetPaths = [
    appJson.expo.icon,
    appJson.expo.android.adaptiveIcon.foregroundImage,
    appJson.expo.android.adaptiveIcon.monochromeImage,
    appJson.expo.web.favicon,
  ];
  for (const assetPath of assetPaths) {
    assert.ok(existsSync(new URL(`../${assetPath.replace(/^\.\//, '')}`, import.meta.url)), assetPath);
  }
});

test('Expo PNG assets preserve platform dimensions and transparency contracts', () => {
  const icon = inspectPng('assets/brand/icon-v5.png');
  assert.deepEqual(icon, { width: 1024, height: 1024, bitDepth: 8, colorType: 2, cornerAlpha: 255 });

  for (const asset of ['adaptive-foreground-v5.png', 'adaptive-monochrome-v5.png', 'splash-v5.png']) {
    const png = inspectPng(`assets/brand/${asset}`);
    assert.equal(png.width, 1024, asset);
    assert.equal(png.height, 1024, asset);
    assert.equal(png.bitDepth, 8, asset);
    assert.equal(png.colorType, 6, asset);
    assert.equal(png.cornerAlpha, 0, `${asset} must have a transparent corner`);
  }

  const favicon = inspectPng('assets/brand/favicon-v5.png');
  assert.equal(favicon.width, 256);
  assert.equal(favicon.height, 256);
  assert.equal(favicon.colorType, 2);
});
