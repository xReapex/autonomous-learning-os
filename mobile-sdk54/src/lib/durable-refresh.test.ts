import { describe, expect, it, vi } from 'vitest';

import { mutateThenRefresh } from './durable-refresh';

describe('mutateThenRefresh', () => {
  it('reports a rejected mutation as not durable and skips refresh', async () => {
    const refresh = vi.fn();

    await expect(mutateThenRefresh(async () => false, refresh)).resolves.toEqual({
      durable: false,
      refreshed: false,
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it('keeps the durable outcome when authoritative refresh fails', async () => {
    await expect(mutateThenRefresh(async () => true, async () => false)).resolves.toEqual({
      durable: true,
      refreshed: false,
    });
  });

  it('reports both durable commit and successful refresh', async () => {
    await expect(mutateThenRefresh(async () => true, async () => true)).resolves.toEqual({
      durable: true,
      refreshed: true,
    });
  });
});
