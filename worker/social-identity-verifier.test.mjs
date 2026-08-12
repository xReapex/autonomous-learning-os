import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createSign } from 'node:crypto';

import { verifySocialIdentityToken } from './social-identity-verifier.mjs';

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', alg: 'RS256', use: 'sig' };

function token(overrides = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    iss: 'https://accounts.google.com', aud: 'google-client', sub: 'subject-1',
    iat: now, exp: now + 300, nonce: 'n'.repeat(43), name: 'Ada', ...overrides,
  })).toString('base64url');
  const signature = createSign('RSA-SHA256').update(`${header}.${payload}`).sign(privateKey).toString('base64url');
  return `${header}.${payload}.${signature}`;
}

test('valide une preuve Google signée avec issuer audience nonce et expiration', async () => {
  await assert.doesNotReject(async () => {
    const identity = await verifySocialIdentityToken({
      provider: 'google', idToken: token(), expectedNonce: 'n'.repeat(43), audience: 'google-client',
    }, { keys: [jwk] });
    assert.deepEqual(identity, { subject: 'subject-1' });
  });
});

test('refuse audience nonce issuer et signature incorrects', async () => {
  for (const input of [
    { audience: 'other-client' },
    { expectedNonce: 'x'.repeat(43) },
    { provider: 'apple' },
  ]) {
    await assert.rejects(verifySocialIdentityToken({
      provider: input.provider ?? 'google', idToken: token(),
      expectedNonce: input.expectedNonce ?? 'n'.repeat(43), audience: input.audience ?? 'google-client',
    }, { keys: [jwk] }), /social_identity_invalid/);
  }
  await assert.rejects(verifySocialIdentityToken({
    provider: 'google', idToken: `${token()}broken`, expectedNonce: 'n'.repeat(43), audience: 'google-client',
  }, { keys: [jwk] }), /social_identity_invalid/);
});

test('refuse les jetons surdimensionnés avant tout appel réseau', async () => {
  let called = false;
  await assert.rejects(verifySocialIdentityToken({
    provider: 'google', idToken: 'x'.repeat(20_000), expectedNonce: 'n'.repeat(43), audience: 'google-client',
  }, { fetchImpl: async () => { called = true; throw new Error('network'); } }), /social_identity_invalid/);
  assert.equal(called, false);
});
