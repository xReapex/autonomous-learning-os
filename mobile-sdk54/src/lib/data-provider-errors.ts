import type { TranslationKey } from './i18n';
import { ApiError, type ApiErrorCode } from '../services/api';

export type DataFailure = {
  status: 'offline' | 'error';
  errorKey: TranslationKey;
};

export type ActivationErrorCode = 'configuration' | 'unauthorized' | 'busy' | 'network' | 'invalid';

export function dataFailureState(error: unknown): DataFailure {
  if (!(error instanceof ApiError)) {
    return { status: 'error', errorKey: 'status.error.body' };
  }
  return {
    status: error.code === 'network' ? 'offline' : 'error',
    errorKey: error.code === 'unexpected'
      ? 'status.error.body'
      : `status.error.${error.code}` as TranslationKey,
  };
}

export function activationErrorCode(error: unknown): ActivationErrorCode {
  if (!(error instanceof ApiError)) return 'invalid';
  const mappings: Record<ApiErrorCode, ActivationErrorCode> = {
    unauthorized: 'unauthorized',
    rate_limited: 'busy',
    timeout: 'network',
    network: 'network',
    server: 'network',
    unexpected: 'invalid',
  };
  return mappings[error.code];
}
