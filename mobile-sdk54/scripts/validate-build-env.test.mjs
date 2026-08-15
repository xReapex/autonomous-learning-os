import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateBuildEnvironment } from './validate-build-env.mjs';

const previewEnvironment = {
  EAS_BUILD_PROFILE: 'preview',
  EXPO_PUBLIC_DEPLOYMENT_ENV: 'preview',
};

test('the SDK 54 compatibility mirror exposes preview builds under a non-Store identity', async () => {
  const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));
  const app = JSON.parse(await readFile(new URL('../app.json', import.meta.url), 'utf8'));
  const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));

  assert.deepEqual(Object.keys(eas.build), ['preview']);
  assert.equal(app.expo.ios.bundleIdentifier, 'io.scio.preview');
  assert.equal(app.expo.android.package, 'io.scio.preview');
  assert.match(packageJson.scripts.export, /validate-build-env\.mjs --local-preview/);
  assert.doesNotMatch(packageJson.scripts['eas-build-pre-install'], /--local-preview/);
});

test('the committed preview profile has a valid effective environment', async () => {
  const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));

  assert.doesNotThrow(() => validateBuildEnvironment({
    ...previewEnvironment,
    ...eas.build.preview.env,
  }));
});

test('rejects every non-preview build profile or deployment from the SDK 54 mirror', () => {
  const validUrls = {
    EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
    EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
  };

  assert.throws(
    () => validateBuildEnvironment({ ...validUrls, EXPO_PUBLIC_DEPLOYMENT_ENV: 'preview' }),
    /sdk54_store_build_forbidden/,
  );
  assert.throws(
    () => validateBuildEnvironment({ ...validUrls, EAS_BUILD_PROFILE: '   ', EXPO_PUBLIC_DEPLOYMENT_ENV: 'preview' }),
    /sdk54_store_build_forbidden/,
  );
  assert.throws(
    () => validateBuildEnvironment({ ...previewEnvironment, ...validUrls, EAS_BUILD_PROFILE: 'production' }),
    /sdk54_store_build_forbidden/,
  );
  assert.throws(
    () => validateBuildEnvironment({ ...previewEnvironment, ...validUrls, EAS_BUILD_PROFILE: 'store' }),
    /sdk54_store_build_forbidden/,
  );
  assert.throws(
    () => validateBuildEnvironment({ ...previewEnvironment, ...validUrls, EXPO_PUBLIC_DEPLOYMENT_ENV: 'production' }),
    /sdk54_store_build_forbidden/,
  );
});

test('rejects local demo mode and gates development identity by deployment', () => {
  assert.throws(
    () => validateBuildEnvironment({ ...previewEnvironment, EXPO_PUBLIC_DEMO_MODE: 'true' }),
    /demo_mode_removed/,
  );
  assert.deepEqual(
    validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_DEV_AUTH_MODE: 'true',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    { mode: 'remote', baseUrl: 'https://api.scio.app/v1', engineUrl: 'https://learning.scio.app/api/mobile' },
  );
});

test('requires a credential-free HTTPS API URL for preview builds', () => {
  assert.throws(() => validateBuildEnvironment(previewEnvironment), /api_url_required/);
  assert.throws(
    () => validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_API_URL: 'http://api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    /api_https_required/,
  );
  assert.throws(
    () => validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_API_URL: 'https://u:p@api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    /api_credentials_forbidden/,
  );
  assert.deepEqual(
    validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    { mode: 'remote', baseUrl: 'https://api.scio.app/v1', engineUrl: 'https://learning.scio.app/api/mobile' },
  );
});

test('rejects an unsafe or credentialed engine URL', () => {
  assert.throws(
    () => validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_API_URL: 'https://api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'http://learning.scio.app/api/mobile',
    }),
    /engine_https_required/,
  );
  assert.throws(
    () => validateBuildEnvironment({
      ...previewEnvironment,
      EXPO_PUBLIC_API_URL: 'https://api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'https://u:p@learning.scio.app/api/mobile',
    }),
    /engine_credentials_forbidden/,
  );
});
