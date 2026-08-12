import { describe, expect, it, vi } from 'vitest';

import { AuthenticatedFetchError, createAuthenticatedFetch } from './authenticated-fetch';

describe('transport SCIO authentifié', () => {
  it('refuse localement toute requête sans session', async () => {
    const fetchImpl = vi.fn();
    const authenticatedFetch = createAuthenticatedFetch({
      fetchImpl,
      getToken: async () => null,
    });

    await expect(authenticatedFetch('https://learning.scio.app/api/mobile/data/progress')).rejects.toMatchObject({
      code: 'missing_session',
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('remplace toute autorisation fournie par le Bearer SCIO', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ ok: true }));
    const authenticatedFetch = createAuthenticatedFetch({
      fetchImpl,
      getToken: async () => 'opaque-scio-session',
    });

    await authenticatedFetch('https://learning.scio.app/api/mobile/data/progress', {
      headers: { Authorization: 'Basic forbidden', 'X-Test': 'preserved' },
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://learning.scio.app/api/mobile/data/progress',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer opaque-scio-session',
          'x-test': 'preserved',
        }),
      }),
    );
  });

  it('expose un type d’erreur stable pour une session absente', () => {
    expect(new AuthenticatedFetchError('missing_session').code).toBe('missing_session');
  });
});
