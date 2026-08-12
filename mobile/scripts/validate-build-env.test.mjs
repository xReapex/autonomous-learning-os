import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { validateBuildEnvironment } from './validate-build-env.mjs';

test('each committed EAS profile has a valid effective environment', async () => {
  const eas = JSON.parse(await readFile(new URL('../eas.json', import.meta.url), 'utf8'));

  for (const profile of ['preview', 'production']) {
    assert.doesNotThrow(() => validateBuildEnvironment({
      EAS_BUILD_PROFILE: profile,
      ...(profile === 'production' ? { SCIO_GOOGLE_SERVER_CLIENT_ID: '123456789-test.apps.googleusercontent.com' } : {}),
      ...eas.build[profile].env,
    }), profile);
  }
});

test('rejects local demo mode and gates development identity by deployment', () => {
  assert.throws(
    () => validateBuildEnvironment({ EXPO_PUBLIC_DEMO_MODE: 'true', EAS_BUILD_PROFILE: 'preview' }),
    /demo_mode_removed/,
  );
  assert.throws(
    () => validateBuildEnvironment({ EXPO_PUBLIC_DEMO_MODE: 'true', EAS_BUILD_PROFILE: 'production' }),
    /demo_mode_removed/,
  );
  assert.throws(
    () => validateBuildEnvironment({
      EXPO_PUBLIC_DEV_AUTH_MODE: 'true',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
      EAS_BUILD_PROFILE: 'production',
    }),
    /production_dev_auth_forbidden/,
  );
  assert.deepEqual(
    validateBuildEnvironment({
      EXPO_PUBLIC_DEPLOYMENT_ENV: 'preview',
      EXPO_PUBLIC_DEV_AUTH_MODE: 'true',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
      EAS_BUILD_PROFILE: 'preview',
    }),
    { mode: 'remote', baseUrl: 'https://api.scio.app/v1', engineUrl: 'https://learning.scio.app/api/mobile' },
  );
  assert.throws(
    () => validateBuildEnvironment({
      EXPO_PUBLIC_DEPLOYMENT_ENV: 'production',
      EXPO_PUBLIC_DEV_AUTH_MODE: 'true',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
      EAS_BUILD_PROFILE: 'preview',
    }),
    /dev_auth_deployment_forbidden/,
  );
});

test('requires a credential-free HTTPS API URL for remote builds', () => {
  assert.throws(() => validateBuildEnvironment({ EAS_BUILD_PROFILE: 'production' }), /api_url_required/);
  assert.throws(
    () => validateBuildEnvironment({
      EAS_BUILD_PROFILE: 'production',
      SCIO_GOOGLE_SERVER_CLIENT_ID: '123456789-test.apps.googleusercontent.com',
      EXPO_PUBLIC_API_URL: 'http://api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    /api_https_required/,
  );
  assert.throws(
    () => validateBuildEnvironment({
      EAS_BUILD_PROFILE: 'production',
      SCIO_GOOGLE_SERVER_CLIENT_ID: '123456789-test.apps.googleusercontent.com',
      EXPO_PUBLIC_API_URL: 'https://u:p@api.scio.app',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    /api_credentials_forbidden/,
  );
  assert.deepEqual(
    validateBuildEnvironment({
      EAS_BUILD_PROFILE: 'production',
      SCIO_GOOGLE_SERVER_CLIENT_ID: '123456789-test.apps.googleusercontent.com',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    { mode: 'remote', baseUrl: 'https://api.scio.app/v1', engineUrl: 'https://learning.scio.app/api/mobile' },
  );
  assert.throws(
    () => validateBuildEnvironment({
      EAS_BUILD_PROFILE: 'production',
      EXPO_PUBLIC_API_URL: 'https://api.scio.app/v1',
      EXPO_PUBLIC_ENGINE_URL: 'https://learning.scio.app/api/mobile',
    }),
    /google_server_client_id_required/,
  );
});

test('rejects an unsafe or credentialed engine URL', () => {
  assert.throws(
    () => validateBuildEnvironment({ EXPO_PUBLIC_API_URL: 'https://api.scio.app', EXPO_PUBLIC_ENGINE_URL: 'http://learning.scio.app/api/mobile' }),
    /engine_https_required/,
  );
  assert.throws(
    () => validateBuildEnvironment({ EXPO_PUBLIC_API_URL: 'https://api.scio.app', EXPO_PUBLIC_ENGINE_URL: 'https://u:p@learning.scio.app/api/mobile' }),
    /engine_credentials_forbidden/,
  );
});
