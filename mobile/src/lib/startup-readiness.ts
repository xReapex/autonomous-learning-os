export type StartupInputs = {
  localeReady: boolean;
  fontsReady: boolean;
  fontError: boolean;
  authChecking: boolean;
  timedOut: boolean;
};

export function startupDecision(inputs: StartupInputs): 'wait' | 'ready' | 'fallback' {
  if (inputs.timedOut) return 'fallback';
  if (!inputs.localeReady || inputs.authChecking || (!inputs.fontsReady && !inputs.fontError)) return 'wait';
  return 'ready';
}
