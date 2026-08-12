export type WatchEvidence = {
  key: string;
  lastPositionSeconds: number | null;
  creditedSeconds: number;
  qualified: boolean;
};

type WatchSample = {
  positionSeconds: number;
  playing: boolean;
  visible: boolean;
  requiredSeconds: number;
};

const maxPlausibleDeltaSeconds = 3;

export function createWatchEvidence(key: string): WatchEvidence {
  return {
    key,
    lastPositionSeconds: null,
    creditedSeconds: 0,
    qualified: false,
  };
}

export function sampleWatchEvidence(evidence: WatchEvidence, sample: WatchSample): WatchEvidence {
  const positionSeconds = Number.isFinite(sample.positionSeconds)
    ? Math.max(0, sample.positionSeconds)
    : 0;
  const previousPosition = evidence.lastPositionSeconds;
  const delta = previousPosition === null ? 0 : positionSeconds - previousPosition;
  const shouldCredit =
    sample.playing &&
    sample.visible &&
    delta > 0 &&
    delta <= maxPlausibleDeltaSeconds;
  const creditedSeconds = evidence.creditedSeconds + (shouldCredit ? delta : 0);

  return {
    ...evidence,
    lastPositionSeconds: positionSeconds,
    creditedSeconds,
    qualified: evidence.qualified || creditedSeconds >= sample.requiredSeconds,
  };
}
