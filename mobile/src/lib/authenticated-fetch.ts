export class AuthenticatedFetchError extends Error {
  constructor(public readonly code: 'missing_session') {
    super(code);
    this.name = 'AuthenticatedFetchError';
  }
}

type AuthenticatedFetchDependencies = {
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export function createAuthenticatedFetch({
  getToken,
  fetchImpl = fetch,
}: AuthenticatedFetchDependencies) {
  return async (url: string, init: RequestInit = {}): Promise<Response> => {
    const token = await getToken();
    if (!token) throw new AuthenticatedFetchError('missing_session');

    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token}`);

    return fetchImpl(url, {
      ...init,
      headers: Object.fromEntries(headers.entries()),
    });
  };
}
