import { describe, expect, it } from 'vitest';

import { palette } from './palette';

function luminance(hex: string): number {
  const channels = hex.slice(1).match(/.{2}/g)!.map((part) => {
    const value = Number.parseInt(part, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((left, right) => right - left);
  return (lighter + 0.05) / (darker + 0.05);
}

describe('SCIO ink, petrol and paper design system', () => {
  it('keeps the approved brand palette stable', () => {
    expect(palette.canvas).toBe('#F5F7F6');
    expect(palette.surface).toBe('#FFFFFF');
    expect(palette.ink).toBe('#10231F');
    expect(palette.primary).toBe('#0F766E');
    expect(palette.primaryDark).toBe('#0B5D57');
    expect(palette.primarySoft).toBe('#DDF3EF');
  });

  it('defines semantic primary tokens with accessible text contrast', () => {
    expect(palette.primary).toMatch(/^#[0-9A-F]{6}$/i);
    expect(palette.primarySoft).toMatch(/^#[0-9A-F]{6}$/i);
    expect(contrast(palette.ink, palette.canvas)).toBeGreaterThanOrEqual(12);
    expect(contrast(palette.white, palette.primary)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.muted, palette.canvas)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.faint, palette.surfaceRaised)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(palette.line, palette.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.line, palette.surfaceRaised)).toBeGreaterThanOrEqual(3);
    expect(contrast(palette.ink, palette.surface)).toBeGreaterThanOrEqual(10);
  });
});
