import { describe, expect, it } from 'vitest';

import { createWatchEvidence, sampleWatchEvidence } from './watch-evidence';

describe('qualified YouTube watch evidence', () => {
  it('credits only plausible forward playback position deltas', () => {
    let evidence = createWatchEvidence('lesson:fr:video-a');
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 10, playing: true, visible: true, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 11.2, playing: true, visible: true, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 12.3, playing: true, visible: true, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 13.2, playing: true, visible: true, requiredSeconds: 3 });

    expect(evidence.creditedSeconds).toBeCloseTo(3.2);
    expect(evidence.qualified).toBe(true);
  });

  it('does not credit hidden/background playback or seek jumps', () => {
    let evidence = createWatchEvidence('lesson:fr:video-a');
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 10, playing: true, visible: true, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 11, playing: true, visible: false, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 50, playing: true, visible: true, requiredSeconds: 3 });
    evidence = sampleWatchEvidence(evidence, { positionSeconds: 51, playing: true, visible: true, requiredSeconds: 3 });

    expect(evidence.creditedSeconds).toBe(1);
    expect(evidence.qualified).toBe(false);
  });

  it('creates fresh evidence for every lesson, locale and video key', () => {
    let french = createWatchEvidence('lesson:fr:video-fr');
    french = sampleWatchEvidence(french, { positionSeconds: 0, playing: true, visible: true, requiredSeconds: 1 });
    french = sampleWatchEvidence(french, { positionSeconds: 1, playing: true, visible: true, requiredSeconds: 1 });
    const english = createWatchEvidence('lesson:en:video-en');

    expect(french.qualified).toBe(true);
    expect(english).toMatchObject({ key: 'lesson:en:video-en', creditedSeconds: 0, qualified: false });
  });
});
