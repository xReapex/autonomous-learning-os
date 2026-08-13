import { describe, expect, it } from 'vitest';

import { createDataOperationCoordinator } from './data-operation-coordinator';

describe('coordination des données autoritaires', () => {
  it('la suppression gagne contre un chargement ancien déjà en train d’écrire le cache', async () => {
    const coordinator = createDataOperationCoordinator();
    let releaseOldWrite!: () => void;
    const oldWriteStarted = new Promise<void>((resolve) => {
      releaseOldWrite = resolve;
    });
    let cache: string | null = null;

    const oldOperation = coordinator.start();
    let allowOldWrite!: () => void;
    const oldWriteBlocked = new Promise<void>((resolve) => {
      allowOldWrite = resolve;
    });
    const oldCommit = coordinator.commit(oldOperation, async () => {
      releaseOldWrite();
      await oldWriteBlocked;
      cache = 'ancien curriculum';
    });

    await oldWriteStarted;
    coordinator.start();
    const deletionCommit = coordinator.start();
    const deleteCommit = coordinator.commit(deletionCommit, async () => {
      cache = null;
    });
    allowOldWrite();

    await expect(oldCommit).resolves.toBe(false);
    await expect(deleteCommit).resolves.toBe(true);
    expect(cache).toBeNull();
  });

  it('un commit obsolète qui n’a pas commencé est ignoré', async () => {
    const coordinator = createDataOperationCoordinator();
    const stale = coordinator.start();
    coordinator.start();
    let wrote = false;

    await expect(coordinator.commit(stale, async () => { wrote = true; })).resolves.toBe(false);
    expect(wrote).toBe(false);
  });

  it('le commit final de suppression ne peut pas être annulé par un nouveau chargement', async () => {
    const coordinator = createDataOperationCoordinator();
    let cache: string | null = 'ancien curriculum';

    const deletion = coordinator.commitLatest(async () => {
      cache = null;
    });
    coordinator.start();

    await expect(deletion).resolves.toBeUndefined();
    expect(cache).toBeNull();
  });

  it('sérialise les mutations distantes dans leur ordre de déclenchement', async () => {
    const coordinator = createDataOperationCoordinator();
    const order: string[] = [];
    let releaseActivation!: () => void;
    const activationBlocked = new Promise<void>((resolve) => {
      releaseActivation = resolve;
    });

    const activation = coordinator.runMutation(async () => {
      order.push('activation:start');
      await activationBlocked;
      order.push('activation:end');
    });
    const deletion = coordinator.runMutation(async () => {
      order.push('deletion');
    });

    await Promise.resolve();
    expect(order).toEqual(['activation:start']);
    releaseActivation();
    await Promise.all([activation, deletion]);
    expect(order).toEqual(['activation:start', 'activation:end', 'deletion']);
  });

  it('conserve le dernier choix utilisateur dans les deux ordres activation-suppression', async () => {
    const activationThenDeletion = createDataOperationCoordinator();
    let firstServer: string | null = null;
    let firstCache: string | null = null;
    const firstActivationOperation = activationThenDeletion.start();
    const firstActivation = activationThenDeletion.runMutation(async () => {
      firstServer = 'nouveau curriculum';
      await activationThenDeletion.commit(firstActivationOperation, async () => {
        firstCache = 'nouveau curriculum';
      });
    });
    activationThenDeletion.start();
    const firstDeletion = activationThenDeletion.runMutation(async () => {
      firstServer = null;
      await activationThenDeletion.commitLatest(async () => {
        firstCache = null;
      });
    });
    await Promise.all([firstActivation, firstDeletion]);
    expect(firstServer).toBeNull();
    expect(firstCache).toBeNull();

    const deletionThenActivation = createDataOperationCoordinator();
    let secondServer: string | null = 'ancien curriculum';
    let secondCache: string | null = 'ancien curriculum';
    deletionThenActivation.start();
    const secondDeletion = deletionThenActivation.runMutation(async () => {
      secondServer = null;
      await deletionThenActivation.commitLatest(async () => {
        secondCache = null;
      });
    });
    const secondActivationOperation = deletionThenActivation.start();
    const secondActivation = deletionThenActivation.runMutation(async () => {
      secondServer = 'nouveau curriculum';
      await deletionThenActivation.commit(secondActivationOperation, async () => {
        secondCache = 'nouveau curriculum';
      });
    });
    await Promise.all([secondDeletion, secondActivation]);
    expect(secondServer).toBe('nouveau curriculum');
    expect(secondCache).toBe('nouveau curriculum');
  });

  it('invalide aussi un chargement parti pendant le DELETE mais revenu après son succès', async () => {
    const coordinator = createDataOperationCoordinator();
    let cache: string | null = 'ancien curriculum';
    coordinator.start();
    const delayedLoad = coordinator.start();

    coordinator.start();
    await coordinator.commitLatest(async () => {
      cache = null;
    });
    const staleCommitted = await coordinator.commit(delayedLoad, async () => {
      cache = 'ancien curriculum retardé';
    });

    expect(staleCommitted).toBe(false);
    expect(cache).toBeNull();
  });
});
