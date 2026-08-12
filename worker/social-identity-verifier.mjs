import { createPublicKey, verify as verifySignature } from 'node:crypto';

const PROVIDERS = Object.freeze({
  google: {
    issuers: new Set(['https://accounts.google.com', 'accounts.google.com']),
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
  },
  apple: {
    issuers: new Set(['https://appleid.apple.com']),
    jwksUrl: 'https://appleid.apple.com/auth/keys',
  },
});

const MAX_TOKEN_BYTES = 16_384;
const keyCache = new Map();

function plain(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function decodePart(value) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('social_identity_invalid');
  return JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
}

function audienceMatches(payload, audience) {
  if (typeof payload.aud === 'string') return payload.aud === audience;
  return Array.isArray(payload.aud)
    && payload.aud.includes(audience)
    && (payload.aud.length === 1 || payload.azp === audience);
}

async function remoteKeys(provider, fetchImpl) {
  const cached = keyCache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.keys;
  const response = await fetchImpl(PROVIDERS[provider].jwksUrl, {
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(5_000),
  });
  if (!response.ok) throw new Error('social_identity_unavailable');
  const body = await response.json();
  if (!plain(body) || !Array.isArray(body.keys) || body.keys.length > 10) {
    throw new Error('social_identity_unavailable');
  }
  keyCache.set(provider, { keys: body.keys, expiresAt: Date.now() + 5 * 60 * 1_000 });
  return body.keys;
}

export async function verifySocialIdentityToken(input, options = {}) {
  if (
    !plain(input) || !Object.hasOwn(PROVIDERS, input.provider)
    || typeof input.idToken !== 'string' || Buffer.byteLength(input.idToken) > MAX_TOKEN_BYTES
    || typeof input.expectedNonce !== 'string' || input.expectedNonce.length < 32 || input.expectedNonce.length > 128
    || typeof input.audience !== 'string' || !input.audience || input.audience.length > 255
  ) throw new Error('social_identity_invalid');

  const parts = input.idToken.split('.');
  if (parts.length !== 3) throw new Error('social_identity_invalid');
  let header;
  let payload;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    throw new Error('social_identity_invalid');
  }
  if (!plain(header) || header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 200 || !plain(payload)) {
    throw new Error('social_identity_invalid');
  }

  const now = Math.floor((options.now?.() ?? Date.now()) / 1000);
  const provider = PROVIDERS[input.provider];
  if (
    !provider.issuers.has(payload.iss)
    || !audienceMatches(payload, input.audience)
    || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255
    || typeof payload.iat !== 'number' || payload.iat > now + 60 || payload.iat < now - 600
    || typeof payload.exp !== 'number' || payload.exp <= now
    || payload.nonce !== input.expectedNonce
  ) throw new Error('social_identity_invalid');

  const keys = options.keys ?? await remoteKeys(input.provider, options.fetchImpl ?? fetch);
  const key = keys.find((candidate) => plain(candidate)
    && candidate.kid === header.kid && candidate.kty === 'RSA'
    && (!candidate.alg || candidate.alg === 'RS256') && (!candidate.use || candidate.use === 'sig'));
  if (!key) throw new Error('social_identity_invalid');

  try {
    const verified = verifySignature(
      'RSA-SHA256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(parts[2], 'base64url'),
    );
    if (!verified) throw new Error('social_identity_invalid');
  } catch {
    throw new Error('social_identity_invalid');
  }

  return { subject: payload.sub };
}
