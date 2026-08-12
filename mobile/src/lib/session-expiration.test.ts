import { describe, expect, it, vi } from 'vitest';

import { emitSessionExpired, subscribeSessionExpired } from './session-expiration';

describe('expiration centralisée de session', () => {
  it('notifie tous les abonnés actifs et permet le désabonnement', () => {
    const first = vi.fn();
    const second = vi.fn();
    const unsubscribe = subscribeSessionExpired(first);
    subscribeSessionExpired(second);
    emitSessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    unsubscribe();
    emitSessionExpired();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
  });
});
