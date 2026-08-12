export type ApiConfiguration = { mode: 'remote'; baseUrl: string };

export type ApiConfigurationErrorCode =
  | 'API_URL_REQUIRED'
  | 'API_URL_INVALID'
  | 'API_HTTPS_REQUIRED'
  | 'API_CREDENTIALS_FORBIDDEN';

export class ApiConfigurationError extends Error {
  constructor(public readonly code: ApiConfigurationErrorCode) {
    super(code);
    this.name = 'ApiConfigurationError';
  }
}

export function resolveApiConfiguration(
  rawUrl: string | undefined,
  isDevelopment: boolean,
  _legacyDemoMode = false,
): ApiConfiguration {
  void _legacyDemoMode;
  const value = rawUrl?.trim();
  if (!value) {
    throw new ApiConfigurationError('API_URL_REQUIRED');
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiConfigurationError('API_URL_INVALID');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new ApiConfigurationError('API_URL_INVALID');
  }

  if (url.username || url.password) {
    throw new ApiConfigurationError('API_CREDENTIALS_FORBIDDEN');
  }

  if (!isDevelopment && url.protocol !== 'https:') {
    throw new ApiConfigurationError('API_HTTPS_REQUIRED');
  }

  if (url.search || url.hash) {
    throw new ApiConfigurationError('API_URL_INVALID');
  }

  return {
    mode: 'remote',
    baseUrl: url.toString().replace(/\/+$/, ''),
  };
}
