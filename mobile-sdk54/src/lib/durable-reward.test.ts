import { describe, expect, it, vi } from 'vitest';

import { rewardAfterDurableMutation } from './durable-reward';

describe('durable reward orchestration', () => {
  it('does not grant when the mutation is rejected', async () => {
    const grant = vi.fn();
    const durable = await rewardAfterDurableMutation(async () => false, grant, { eventId: 'event-1' });

    expect(durable).toBe(false);
    expect(grant).not.toHaveBeenCalled();
  });

  it('grants exactly once after the mutation is durable', async () => {
    const order: string[] = [];
    const event = { eventId: 'event-2' };
    const durable = await rewardAfterDurableMutation(
      async () => { order.push('mutation'); return true; },
      async (received) => { order.push(`grant:${received.eventId}`); },
      event,
    );

    expect(durable).toBe(true);
    expect(order).toEqual(['mutation', 'grant:event-2']);
  });
});
