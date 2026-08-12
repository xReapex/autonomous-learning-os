import { describe, expect, it } from 'vitest';

import { resolveContentLocale } from './content-locale';

describe('resolveContentLocale', () => {
  it('keeps the generated course language when the interface changes', () => {
    expect(resolveContentLocale('fr', 'en')).toBe('fr');
    expect(resolveContentLocale('en', 'fr')).toBe('en');
  });

  it('uses the interface locale for bilingual legacy courses', () => {
    expect(resolveContentLocale(undefined, 'fr')).toBe('fr');
    expect(resolveContentLocale(undefined, 'en')).toBe('en');
  });
});
