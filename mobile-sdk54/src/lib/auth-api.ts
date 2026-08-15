import type { AuthSession, AuthUser } from './auth-session-core';

export type ServerAuthSession = AuthSession;
export type SocialProvider = 'google' | 'apple';

type TokenStorage = {
  get: () => Promise<string | null>;
  set: (token: string) => Promise<void>;
  clear: () => Promise<void>;
};

type AuthApiOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  restoreTimeoutMs?: number;
  tokenStorage: TokenStorage;
};

function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('auth_url_invalid');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('auth_url_invalid');
  }
  return url.toString().replace(/\/+$/, '');
}

function validUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<AuthUser>;
  return (
    typeof candidate.id === 'string' &&
    /^usr_[a-zA-Z0-9_-]{16,}$/.test(candidate.id) &&
    typeof candidate.displayName === 'string' &&
    candidate.displayName.length > 0 &&
    candidate.displayName.length <= 120 &&
    (candidate.provider === 'development' || candidate.provider === 'google' || candidate.provider === 'apple')
  );
}

function parseIdentity(value: unknown): ServerAuthSession {
  if (!value || typeof value !== 'object') throw new Error('auth_response_invalid');
  const candidate = value as Partial<ServerAuthSession>;
  if (
    !validUser(candidate.user) ||
    (candidate.entitlement !== 'demo' && candidate.entitlement !== 'full') ||
    typeof candidate.expiresAt !== 'string' ||
    !Number.isFinite(Date.parse(candidate.expiresAt))
  ) {
    throw new Error('auth_response_invalid');
  }
  return {
    user: candidate.user,
    entitlement: candidate.entitlement,
    expiresAt: candidate.expiresAt,
  };
}

function validToken(value: unknown): value is string {
  return typeof value === 'string' && /^scio_[A-Za-z0-9_-]{40,}$/.test(value);
}

async function socialError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { code?: unknown } };
    if (typeof payload.error?.code === 'string') return new Error(payload.error.code);
  } catch {
    // Fall through to a stable client-side error.
  }
  return new Error('social_auth_failed');
}

export function createAuthApi({ baseUrl, fetchImpl = fetch, restoreTimeoutMs = 8_000, tokenStorage }: AuthApiOptions) {
  const authUrl = `${normalizeBaseUrl(baseUrl)}/mobile/auth`;

  async function authorizedRequest(
    path: string,
    method: 'GET' | 'DELETE',
    init: Omit<RequestInit, 'method'> = {},
  ): Promise<Response | null> {
    const token = await tokenStorage.get();
    if (!token) return null;
    return fetchImpl(`${authUrl}${path}`, {
      ...init,
      method,
      headers: { Accept: 'application/json', Authorization: 'Bea' + 'rer ' + token, ...(init.headers ?? {}) },
    });
  }

  return {
    async createSocialChallenge(provider: SocialProvider): Promise<{ state: string; nonce: string; expiresAt: string }> {
      const response = await fetchImpl(`${authUrl}/social/challenge?provider=${provider}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (response.status !== 201) throw await socialError(response);
      const payload = await response.json() as Record<string, unknown>;
      if (
        typeof payload.state !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(payload.state) ||
        typeof payload.nonce !== 'string' || !/^[A-Za-z0-9_-]{40,128}$/.test(payload.nonce) ||
        typeof payload.expiresAt !== 'string' || !Number.isFinite(Date.parse(payload.expiresAt))
      ) {
        throw new Error('auth_response_invalid');
      }
      return { state: payload.state, nonce: payload.nonce, expiresAt: payload.expiresAt };
    },

    async exchangeSocialIdentity(
      provider: SocialProvider,
      state: string,
      idToken: string,
    ): Promise<ServerAuthSession> {
      const response = await fetchImpl(`${authUrl}/social/exchange`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, state, idToken }),
      });
      if (response.status !== 201) throw await socialError(response);
      const payload = await response.json();
      const identity = parseIdentity(payload);
      if (identity.user.provider !== provider) throw new Error('auth_response_invalid');
      const token = (payload as { token?: unknown }).token;
      if (!validToken(token)) throw new Error('auth_response_invalid');
      await tokenStorage.set(token);
      return identity;
    },

    async signInDevelopment(): Promise<ServerAuthSession> {
      const response = await fetchImpl(`${authUrl}/development`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (response.status !== 201) throw new Error('auth_sign_in_failed');
      const payload = await response.json();
      const identity = parseIdentity(payload);
      const token = (payload as { token?: unknown }).token;
      if (!validToken(token)) throw new Error('auth_response_invalid');
      await tokenStorage.set(token);
      return identity;
    },

    async restore(): Promise<ServerAuthSession | null> {
      const controller = new AbortController();
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const operation = (async () => {
        const response = await authorizedRequest('/session', 'GET', { signal: controller.signal });
        if (!response) return null;
        if (response.status === 401) throw new Error('auth_session_expired');
        if (!response.ok) throw new Error('auth_restore_failed');
        return parseIdentity(await response.json());
      })();
      const deadline = new Promise<never>((_resolve, reject) => {
        timeout = setTimeout(() => {
          reject(new Error('auth_restore_timeout'));
          controller.abort();
        }, restoreTimeoutMs);
      });
      try {
        return await Promise.race([operation, deadline]);
      } finally {
        if (timeout) clearTimeout(timeout);
        controller.abort();
      }
    },

    async signOut(): Promise<void> {
      const response = await authorizedRequest('/session', 'DELETE');
      if (!response) {
        await tokenStorage.clear();
        return;
      }
      if (response.status !== 204 && response.status !== 401) throw new Error('auth_revoke_failed');
      await tokenStorage.clear();
    },

    async deleteAccount(): Promise<void> {
      const response = await authorizedRequest('/account', 'DELETE');
      if (!response) throw new Error('auth_delete_unauthorized');
      if (response.status !== 204) throw new Error('auth_delete_failed');
      await tokenStorage.clear();
    },

    async clearLocalToken(): Promise<void> {
      await tokenStorage.clear();
    },
  };
}
