import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '../services/api';
import { activationErrorCode, dataFailureState } from './data-provider-errors';

vi.mock('expo-secure-store', () => ({ getItemAsync: vi.fn() }));

describe('erreurs des mutations de données', () => {
  it.each([
    ['unauthorized', 'error', 'status.error.unauthorized'],
    ['rate_limited', 'error', 'status.error.rate_limited'],
    ['server', 'error', 'status.error.server'],
    ['timeout', 'error', 'status.error.timeout'],
    ['network', 'offline', 'status.error.network'],
  ] as const)('préserve %s dans l’état global', (code, status, errorKey) => {
    expect(dataFailureState(new ApiError(code))).toEqual({ status, errorKey });
  });

  it.each([
    ['unauthorized', 'unauthorized'],
    ['rate_limited', 'busy'],
    ['server', 'network'],
    ['timeout', 'network'],
    ['network', 'network'],
    ['unexpected', 'invalid'],
  ] as const)('traduit %s pour l’écran de création', (code, expected) => {
    expect(activationErrorCode(new ApiError(code))).toBe(expected);
  });
});
