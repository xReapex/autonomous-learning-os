export type AuthRestoreStatus = 'expired' | 'restore-error';

export function authStatusAfterRestoreError(error: unknown): AuthRestoreStatus {
  return error instanceof Error && error.message === 'auth_session_expired'
    ? 'expired'
    : 'restore-error';
}
