import { describe, expect, it } from 'vitest';

import { resolveAuthProvider } from './auth-policy';

describe('politique d’authentification SCIO', () => {
  it('autorise le provider de développement uniquement dans l’environnement preview explicite', () => {
    expect(resolveAuthProvider({
      isDevelopment: false,
      deploymentEnvironment: 'preview',
      developmentAuthEnabled: true,
      platform: 'android',
      googleConfigured: false,
      appleConfigured: false,
    })).toBe('development');
    expect(resolveAuthProvider({
      isDevelopment: true,
      deploymentEnvironment: 'production',
      developmentAuthEnabled: true,
      platform: 'android',
      googleConfigured: false,
      appleConfigured: false,
    })).toBe('unavailable');
  });

  it('sélectionne Google sur Android et Apple sur iOS', () => {
    expect(resolveAuthProvider({
      isDevelopment: false,
      deploymentEnvironment: 'production',
      developmentAuthEnabled: false,
      platform: 'android',
      googleConfigured: true,
      appleConfigured: false,
    })).toBe('google');
    expect(resolveAuthProvider({
      isDevelopment: false,
      deploymentEnvironment: 'production',
      developmentAuthEnabled: false,
      platform: 'ios',
      googleConfigured: false,
      appleConfigured: true,
    })).toBe('apple');
  });

  it('échoue fermé sans provider valide', () => {
    expect(resolveAuthProvider({
      isDevelopment: false,
      deploymentEnvironment: 'production',
      developmentAuthEnabled: false,
      platform: 'android',
      googleConfigured: false,
      appleConfigured: true,
    })).toBe('unavailable');
  });
});
