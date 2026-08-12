import { describe, expect, it } from 'vitest';

import { ApiConfigurationError, resolveApiConfiguration } from './api-url';

describe('API URL configuration', () => {
  it('requires an API URL even when a legacy demo flag is passed', () => {
    expect(() => resolveApiConfiguration(undefined, false, true)).toThrowError(
      new ApiConfigurationError('API_URL_REQUIRED'),
    );
    expect(() => resolveApiConfiguration(undefined, false, false)).toThrowError(
      new ApiConfigurationError('API_URL_REQUIRED'),
    );
    expect(() => resolveApiConfiguration('   ', true, false)).toThrowError(
      new ApiConfigurationError('API_URL_REQUIRED'),
    );
  });

  it('normalizes a secure API base URL', () => {
    expect(resolveApiConfiguration('https://api.scio.io/v1///', false)).toEqual({
      mode: 'remote',
      baseUrl: 'https://api.scio.io/v1',
    });
  });

  it('rejects HTTP outside development', () => {
    expect(() => resolveApiConfiguration('http://api.scio.io', false)).toThrowError(
      new ApiConfigurationError('API_HTTPS_REQUIRED'),
    );
  });

  it('allows HTTP during development without allowing embedded credentials', () => {
    expect(resolveApiConfiguration('http://localhost:3000/api', true)).toEqual({
      mode: 'remote',
      baseUrl: 'http://localhost:3000/api',
    });
    expect(() =>
      resolveApiConfiguration('https://user:password@api.scio.io', true),
    ).toThrowError(new ApiConfigurationError('API_CREDENTIALS_FORBIDDEN'));
  });

  it('rejects malformed and non-HTTP URLs', () => {
    expect(() => resolveApiConfiguration('not a url', true)).toThrowError(
      new ApiConfigurationError('API_URL_INVALID'),
    );
    expect(() => resolveApiConfiguration('ftp://api.scio.io', true)).toThrowError(
      new ApiConfigurationError('API_URL_INVALID'),
    );
  });
});
