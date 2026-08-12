import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('aucun chemin d’authentification moteur Basic ou séparé ne reste actif', async () => {
  const [engine, createCourse, layout, keys, dataProvider, api] = await Promise.all([
    source('src/lib/engine-api.ts'),
    source('src/app/create-course.tsx'),
    source('src/app/_layout.tsx'),
    source('src/lib/secure-store-keys.ts'),
    source('src/providers/data-provider.tsx'),
    source('src/services/api.ts'),
  ]);
  const activeSources = `${engine}\n${createCourse}\n${layout}\n${keys}`;

  assert.doesNotMatch(activeSources, /exchangeEngineSession|hasEngineSession|AccountSessionProvider|engineTokenKey/);
  assert.doesNotMatch(createCourse, /\busername\b|\bpassword\b|stage === 'connect'/);
  assert.doesNotMatch(engine, /\bBasic\b|\bbtoa\b|fetch\([^\n]*\/session\b/);
  assert.doesNotMatch(dataProvider, /generatedDataKey|scio:generated-data|readGeneratedData/);
  assert.match(dataProvider, /replaceCurriculum/);
  assert.doesNotMatch(api, /EXPO_PUBLIC_DEMO_MODE/);
});
