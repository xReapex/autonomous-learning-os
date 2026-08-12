import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createWorkerServer } from './server.mjs';

const servers = [];
test.afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))));

async function start(verifySocialIdentity) {
  const server = createWorkerServer({ secret: 's'.repeat(32), verifySocialIdentity, ignoreBudget: true });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  return server.address().port;
}

async function post(port, body, secret = 's'.repeat(32)) {
  return fetch(`http://127.0.0.1:${port}/social/verify`, {
    method: 'POST',
    headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('la route interne sociale exige le bearer worker et retourne seulement une identité', async () => {
  const port = await start(async (body) => {
    assert.equal(body.provider, 'google');
    return { subject: 'subject-1' };
  });
  const unauthorized = await post(port, { provider: 'google' }, 'wrong-secret-that-is-long-enough-123456');
  const accepted = await post(port, { provider: 'google' });
  assert.equal(unauthorized.status, 401);
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { subject: 'subject-1' });
});

test('la route sociale borne le corps et masque les erreurs', async () => {
  const port = await start(async () => { throw new Error('social_identity_invalid'); });
  const invalid = await post(port, { provider: 'google' });
  const oversized = await post(port, { idToken: 'x'.repeat(70_000) });
  assert.equal(invalid.status, 401);
  assert.deepEqual(await invalid.json(), { error: 'social_identity_invalid' });
  assert.equal(oversized.status, 413);
});
