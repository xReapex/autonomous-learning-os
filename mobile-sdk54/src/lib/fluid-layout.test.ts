import { describe, expect, it } from 'vitest';

import { resolveFluidLayout } from './fluid-layout';

describe('fluid mobile layout', () => {
  it.each([
    [320, 568, 1],
    [360, 800, 1],
    [390, 844, 1],
    [430, 932, 1],
    [768, 1024, 1],
    [1024, 1366, 1.5],
  ])('adapte la géométrie à %ix%i avec fontScale %s', (width, height, fontScale) => {
    const layout = resolveFluidLayout(width, height, fontScale);
    expect(layout.gutter).toBeGreaterThan(0);
    expect(layout.gutter).toBeLessThan(Math.min(width, height) * 0.1);
    expect(layout.controlSize).toBeGreaterThanOrEqual(48);
    expect(layout.tabBarHeight).toBeGreaterThan(layout.controlSize);
  });

  it('élargit les espacements et borne la ligne de lecture sur tablette', () => {
    const phone = resolveFluidLayout(390, 844, 1);
    const tablet = resolveFluidLayout(834, 1194, 1);
    expect(tablet.gutter).toBeGreaterThan(phone.gutter);
    expect(tablet.contentWidth).toBe('78%');
    expect(phone.contentWidth).toBe('100%');
  });

  it('bascule les compositions en mode compact avec Dynamic Type', () => {
    expect(resolveFluidLayout(430, 932, 1.5).compact).toBe(true);
    expect(resolveFluidLayout(430, 932, 1).compact).toBe(false);
  });
});
