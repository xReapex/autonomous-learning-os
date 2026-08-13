import { describe, expect, it } from 'vitest';

import { createDataOperationCoordinator } from './data-operation-coordinator';

describe('coordination des données autoritaires', () => {
  it('rollback une préparation devenue obsolète sans publier son état', async () => {
    const coordinator = createDataOperationCoordinator();
    const operation = coordinator.start();
    let releasePreparation!: () => void;
    let preparationStarted!: () => void;
    const started = new Promise<void>((resolve) => { preparationStarted = resolve; });
    const blocked = new Promise<void>((resolve) => { releasePreparation = resolve; });
    let cache: string | null = null;
    let published = false;

    const result = coordinator.commitPrepared(
      operation,
      async () => {
        cache = 'snapshot obsolète';
        preparationStarted();
        await blocked;
      },
      () => { published = true; return true; },
      async () => { cache = null; },
    );

    await started;
    coordinator.start();
    releasePreparation();

    await expect(result).resolves.toBe(false);
    expect(cache).toBeNull();
    expect(published).toBe(false);
  });

  it('publie synchroniquement une préparation restée courante', async () => {
    const coordinator = createDataOperationCoordinator();
    const operation = coordinator.start();
    const order: string[] = [];

    await expect(coordinator.commitPrepared(
      operation,
      async () => { order.push('prepare'); },
      () => { order.push('publish'); return true; },
      async () => { order.push('rollback'); },
    )).resolves.toBe(true);

    expect(order).toEqual(['prepare', 'publish']);
  });

  it('la suppression gagne contre un chargement ancien pendant son écriture locale', async () => {
    const coordinator = createDataOperationCoordinator();
    const oldOperation = coordinator.start();
    let releaseOldWrite!: () => void;
    let oldWriteStarted!: () => void;
    const started = new Promise<void>((resolve) => { oldWriteStarted = resolve; });
    const blocked = new Promise<void>((resolve) => { releaseOldWrite = resolve; });
    let cache: string | null = null;

    const oldCommit = coordinator.commitPrepared(
      oldOperation,
      async () => {
        cache = 'ancien curriculum';
        oldWriteStarted();
        await blocked;
      },
      () => true,
      async () => { cache = null; },
    );

    await started;
    const deletionOperation = coordinator.start();
    const deletionCommit = coordinator.commit(deletionOperation, () => {
      cache = null;
      return true;
    });
    releaseOldWrite();

    await expect(oldCommit).resolves.toBe(false);
    await expect(deletionCommit).resolves.toBe(true);
    expect(cache).toBeNull();
  });

  it('ignore un commit obsolète qui n’a pas commencé', async () => {
    const coordinator = createDataOperationCoordinator();
    const stale = coordinator.start();
    coordinator.start();
    let wrote = false;

    await expect(coordinator.commit(stale, () => { wrote = true; return true; })).resolves.toBe(false);
    expect(wrote).toBe(false);
  });

  it('sérialise les mutations distantes dans leur ordre de déclenchement', async () => {
    const coordinator = createDataOperationCoordinator();
    const order: string[] = [];
    let releaseActivation!: () => void;
    const activationBlocked = new Promise<void>((resolve) => { releaseActivation = resolve; });

    const activation = coordinator.runMutation(async () => {
      order.push('activation:start');
      await activationBlocked;
      order.push('activation:end');
    });
    const deletion = coordinator.runMutation(async () => { order.push('deletion'); });

    await Promise.resolve();
    expect(order).toEqual(['activation:start']);
    releaseActivation();
    await Promise.all([activation, deletion]);
    expect(order).toEqual(['activation:start', 'activation:end', 'deletion']);
  });

  it.each([
    ['activation', 'suppression', null],
    ['suppression', 'activation', 'nouveau curriculum'],
  ] as const)('conserve le dernier choix %s puis %s', async (first, second, expected) => {
    const coordinator = createDataOperationCoordinator();
    let cache: string | null = 'ancien curriculum';

    const mutate = (choice: 'activation' | 'suppression') => coordinator.runMutation(async () => {
      const operation = coordinator.start();
      const value = choice === 'activation' ? 'nouveau curriculum' : null;
      await coordinator.commit(operation, () => {
        cache = value;
        return true;
      });
    });

    await Promise.all([mutate(first), mutate(second)]);
    expect(cache).toBe(expected);
  });

  it('rejette un chargement parti avant le retrait mais revenu après son succès', async () => {
    const coordinator = createDataOperationCoordinator();
    let cache: string | null = 'ancien curriculum';
    const delayedLoad = coordinator.start();
    const deletion = coordinator.start();

    await coordinator.commit(deletion, () => {
      cache = null;
      return true;
    });
    const staleCommitted = await coordinator.commit(delayedLoad, () => {
      cache = 'ancien curriculum retardé';
      return true;
    });

    expect(staleCommitted).toBe(false);
    expect(cache).toBeNull();
  });
});
