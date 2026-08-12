import type { SocialProvider } from './scio-auth-store';

export function socialAudienceFromEnvironment(provider: SocialProvider): string | null {
  const key = provider === 'google' ? 'SCIO_GOOGLE_SERVER_CLIENT_ID' : 'SCIO_APPLE_CLIENT_ID';
  const value = process.env[key]?.trim();
  return value && value.length <= 255 ? value : null;
}

export function parseSocialProvider(value: unknown): SocialProvider | null {
  return value === 'google' || value === 'apple' ? value : null;
}

export async function boundedJson(request: Request, maximumBytes = 20_000): Promise<unknown> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maximumBytes) throw new Error('request_too_large');
  const text = await request.text();
  if (Buffer.byteLength(text, 'utf8') > maximumBytes) throw new Error('request_too_large');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('request_invalid');
  }
}

export function socialExchangeBody(value: unknown): {
  provider: SocialProvider;
  state: string;
  idToken: string;
} {
  if (!value || typeof value !== 'object') throw new Error('request_invalid');
  const candidate = value as Record<string, unknown>;
  const provider = parseSocialProvider(candidate.provider);
  if (
    !provider ||
    typeof candidate.state !== 'string' || candidate.state.length < 40 || candidate.state.length > 128 ||
    typeof candidate.idToken !== 'string' || candidate.idToken.length < 100 || candidate.idToken.length > 16_384
  ) {
    throw new Error('request_invalid');
  }
  return { provider, state: candidate.state, idToken: candidate.idToken };
}
