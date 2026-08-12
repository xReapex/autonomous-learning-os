import { describe, expect, it } from 'vitest';

import { getInitialLocale, translate, translations } from './i18n';

describe('i18n', () => {
  it('gives the explicit stored locale precedence over the device locale', () => {
    expect(getInitialLocale('en', ['fr-FR'])).toBe('en');
  });

  it('detects French or English and falls back to French', () => {
    expect(getInitialLocale(null, ['en-GB'])).toBe('en');
    expect(getInitialLocale(null, ['fr-CA'])).toBe('fr');
    expect(getInitialLocale(null, ['de-DE'])).toBe('fr');
  });

  it('keeps the French and English catalogues complete', () => {
    expect(Object.keys(translations.en).sort()).toEqual(Object.keys(translations.fr).sort());
  });

  it('interpolates localized values', () => {
    expect(translate('fr', 'home.greeting', { name: 'Camille' })).toBe('Bonjour, Camille');
    expect(translate('en', 'home.greeting', { name: 'Camille' })).toBe('Hello, Camille');
  });
});
