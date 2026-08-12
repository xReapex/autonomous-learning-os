import { describe, expect, it, vi } from 'vitest';

import { commitAfterDurableMutation } from './durable-mutation';

describe('durable mutation commit ordering', () => {
  it('does not commit optimistic state after a rejected mutation', async () => {
    const commit = vi.fn();
    const durable = await commitAfterDurableMutation(async () => false, commit);

    expect(durable).toBe(false);
    expect(commit).not.toHaveBeenCalled();
  });

  it('commits exactly once after a durable mutation', async () => {
    const order: string[] = [];
    const durable = await commitAfterDurableMutation(
      async () => { order.push('mutation'); return true; },
      () => { order.push('commit'); },
    );

    expect(durable).toBe(true);
    expect(order).toEqual(['mutation', 'commit']);
  });
});
