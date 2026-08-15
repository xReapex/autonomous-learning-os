import { describe, expect, it } from 'vitest';

import { authStatusAfterRestoreError } from './auth-restore-state';

describe('authStatusAfterRestoreError', () => {
  it('distingue une session serveur expirée d’un échec de restauration récupérable', () => {
    expect(authStatusAfterRestoreError(new Error('auth_session_expired'))).toBe('expired');
    expect(authStatusAfterRestoreError(new Error('auth_restore_failed'))).toBe('restore-error');
    expect(authStatusAfterRestoreError(new TypeError('Network request failed'))).toBe('restore-error');
    expect(authStatusAfterRestoreError('unknown')).toBe('restore-error');
  });
});
