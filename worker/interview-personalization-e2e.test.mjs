import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';

import { createWorkerServer } from './server.mjs';

const secret = 's'.repeat(32);
const servers = [];
test.afterEach(async () => Promise.all(servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve)))));

async function post(port, body) {
  const response = await fetch(`http://127.0.0.1:${port}/interview`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${secret}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('la réponse HTTP personnalise la question canonique avec le sujet signé', async () => {
  const generated = [
    {
      phase: 'question',
      questionTopic: 'subject',
      message: 'ignored opening',
      choices: ['Une langue', 'Une compétence pratique', 'Un sujet théorique'],
      progress: 0,
      document: null,
    },
    {
      phase: 'question',
      questionTopic: 'current_method',
      message: 'ignored generic wording',
      choices: ['Je débute', 'Je lis déjà des articles', 'Je pratique chaque semaine'],
      progress: 17,
      document: null,
    },
  ];
  const server = createWorkerServer({
    secret,
    ignoreBudget: true,
    generate: async () => generated.shift(),
  });
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;

  const opening = await post(port, { locale: 'fr' });
  assert.equal(opening.message, 'Quel sujet précis souhaitez-vous apprendre ?');
  const personalized = await post(port, {
    state: opening.state,
    answer: 'la cryptographie post-quantique',
  });

  assert.equal(personalized.message, 'Comment apprenez-vous actuellement « la cryptographie post-quantique » ?');
  assert.doesNotMatch(personalized.message, /ce sujet/i);
});
