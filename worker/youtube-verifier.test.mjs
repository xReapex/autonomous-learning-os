import test from 'node:test';
import assert from 'node:assert/strict';

import { verifyYouTubeSource } from './youtube-verifier.mjs';

const source = {
  title: 'Comprendre la dérivée',
  provider: 'Maths et Tiques',
  language: 'fr',
  url: 'https://www.youtube.com/watch?v=abcdefghijk',
  embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
};

function response(body, options = {}) {
  return new Response(body, {
    status: options.status ?? 200,
    headers: { 'content-type': options.type ?? 'text/html; charset=utf-8' },
  });
}

test('vérifie oEmbed puis le lecteur nocookie du même identifiant', async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(String(url));
    if (String(url).includes('/oembed?')) {
      return response(JSON.stringify({ title: source.title, author_name: source.provider }), { type: 'application/json' });
    }
    return response('<html><title>YouTube</title></html>');
  };
  await verifyYouTubeSource(source, 'fr', { fetcher, deadlineAt: Date.now() + 1_000 });
  assert.equal(calls.length, 2);
  assert.match(calls[0], /youtube\.com\/oembed/);
  assert.equal(calls[1], source.embedUrl);
});

test('refuse une autre langue, un oEmbed absent ou un lecteur indisponible', async () => {
  const okFetcher = async (url) => String(url).includes('/oembed?')
    ? response(JSON.stringify({ title: source.title, author_name: source.provider }), { type: 'application/json' })
    : response('<html></html>');
  await assert.rejects(() => verifyYouTubeSource({ ...source, language: 'en' }, 'fr', { fetcher: okFetcher }), /language/);

  const missing = async () => response('not found', { status: 404 });
  await assert.rejects(() => verifyYouTubeSource(source, 'fr', { fetcher: missing }), /oembed/);

  let count = 0;
  const blockedEmbed = async () => ++count === 1
    ? response(JSON.stringify({ title: source.title, author_name: source.provider }), { type: 'application/json' })
    : response('forbidden', { status: 403 });
  await assert.rejects(() => verifyYouTubeSource(source, 'fr', { fetcher: blockedEmbed }), /embed/);
});
