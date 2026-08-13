import { describe, expect, it, vi } from 'vitest';

import { removeCurriculumDurably } from './curriculum-removal';

describe('suppression durable du sujet actif', () => {
  it('efface le cache seulement après confirmation du serveur', async () => {
    const order: string[] = [];

    await removeCurriculumDurably({
      removeRemote: async () => { order.push('server'); return `"${'e'.repeat(64)}"`; },
      removeCache: async (revision) => { order.push(`cache:${revision}`); },
    });

    expect(order).toEqual(['server', `cache:"${'e'.repeat(64)}"`]);
  });

  it('conserve le cache si le serveur refuse la suppression', async () => {
    const removeCache = vi.fn();

    await expect(removeCurriculumDurably({
      removeRemote: async () => { throw new Error('server'); },
      removeCache,
    })).rejects.toThrow('server');

    expect(removeCache).not.toHaveBeenCalled();
  });
});
