import { describe, expect, it, vi } from 'vitest';

import { publishPersistedReward } from './reward-persistence';
import { applyReward, createInitialRewardState } from './rewards';

const result = applyReward(createInitialRewardState(), {
  eventId: 'lesson:durable',
  type: 'lesson_completed',
  occurredAt: '2026-08-12T13:00:00.000Z',
});

describe('publishPersistedReward', () => {
  it('persists before publishing the reward', async () => {
    const order: string[] = [];
    const persist = vi.fn(async () => { order.push('persist'); });
    const publish = vi.fn(() => { order.push('publish'); });

    await publishPersistedReward(result, persist, publish);

    expect(order).toEqual(['persist', 'publish']);
  });

  it('does not publish when persistence fails', async () => {
    const publish = vi.fn();

    await expect(publishPersistedReward(
      result,
      async () => { throw new Error('disk_full'); },
      publish,
    )).rejects.toThrow('disk_full');
    expect(publish).not.toHaveBeenCalled();
  });
});
