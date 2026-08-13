import { describe, expect, it, vi } from 'vitest';

import { createDataOperationCoordinator } from './data-operation-coordinator';
import { runCoordinatedSync } from './coordinated-sync';

describe('mutation pédagogique coordonnée', () => {
  it('termine une ancienne mutation avant une activation déclenchée ensuite', async () => {
    const coordinator = createDataOperationCoordinator();
    const order: string[] = [];
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => { release = resolve; });

    const learningMutation = runCoordinatedSync({
      coordinator,
      mutate: async () => {
        order.push('learning:start');
        await blocked;
        order.push('learning:end');
      },
      onFailure: vi.fn(),
    });
    const activation = coordinator.runMutation(async () => {
      order.push('activation');
    });

    await Promise.resolve();
    expect(order).toEqual(['learning:start']);
    release();
    await Promise.all([learningMutation, activation]);
    expect(order).toEqual(['learning:start', 'learning:end', 'activation']);
  });

  it('ne publie pas une erreur obsolète après une opération autoritaire plus récente', async () => {
    const coordinator = createDataOperationCoordinator();
    const onFailure = vi.fn();
    let reject!: (error: Error) => void;
    const blocked = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });

    const mutation = runCoordinatedSync({
      coordinator,
      mutate: () => blocked,
      onFailure,
    });
    await Promise.resolve();
    coordinator.start();
    reject(new Error('late failure'));

    await expect(mutation).resolves.toBe(false);
    expect(onFailure).not.toHaveBeenCalled();
  });
});
