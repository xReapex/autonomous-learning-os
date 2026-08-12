import { describe, expect, it } from 'vitest';

import { startupDecision } from './startup-readiness';

describe('startupDecision', () => {
  it('waits while locale, fonts or auth are still loading within the deadline', () => {
    expect(startupDecision({ localeReady: true, fontsReady: false, fontError: false, authChecking: false, timedOut: false })).toBe('wait');
    expect(startupDecision({ localeReady: true, fontsReady: true, fontError: false, authChecking: true, timedOut: false })).toBe('wait');
  });

  it('continues with system fonts after a font error', () => {
    expect(startupDecision({ localeReady: true, fontsReady: false, fontError: true, authChecking: false, timedOut: false })).toBe('ready');
  });

  it('revient à ready dès que les prérequis finissent après le délai', () => {
    expect(startupDecision({ localeReady: true, fontsReady: true, fontError: false, authChecking: false, timedOut: true })).toBe('ready');
  });

  it('fails open to the signed-out UI after the bounded startup deadline', () => {
    expect(startupDecision({ localeReady: false, fontsReady: false, fontError: false, authChecking: true, timedOut: true })).toBe('fallback');
  });
});
