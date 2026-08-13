import { describe, expect, it, vi } from 'vitest';

import { commitOperationFailure } from './operation-failure';
import { createDataOperationCoordinator } from './data-operation-coordinator';

describe('erreur d’opération autoritaire', () => {
  it('ignore l’erreur si une opération plus récente a commencé', async () => {
    const coordinator = createDataOperationCoordinator();
    const stale = coordinator.start();
    coordinator.start();
    const publish = vi.fn();

    await expect(commitOperationFailure(coordinator, stale, publish)).resolves.toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  it('publie l’erreur si l’opération reste courante', async () => {
    const coordinator = createDataOperationCoordinator();
    const current = coordinator.start();
    const publish = vi.fn();

    await expect(commitOperationFailure(coordinator, current, publish)).resolves.toBe(true);
    expect(publish).toHaveBeenCalledOnce();
  });
});
