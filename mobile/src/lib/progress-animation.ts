const indeterminateSegmentRatio = 0.34;

export function resolveIndeterminateOffset(
  trackWidth: number,
  phase: number,
  reducedMotion: boolean,
): number {
  'worklet';
  const width = Math.max(0, trackWidth);
  const normalizedPhase = reducedMotion ? 0.5 : Math.max(0, Math.min(1, phase));
  return width * (1 - indeterminateSegmentRatio) * normalizedPhase;
}
