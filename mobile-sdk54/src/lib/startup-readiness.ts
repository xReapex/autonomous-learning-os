export type StartupInputs = {
  localeReady: boolean;
  fontsReady: boolean;
  fontError: boolean;
  authChecking: boolean;
  timedOut: boolean;
};

export function startupDecision(inputs: StartupInputs): 'wait' | 'ready' | 'fallback' {
  const blocked = !inputs.localeReady || inputs.authChecking || (!inputs.fontsReady && !inputs.fontError);
  if (blocked) return inputs.timedOut ? 'fallback' : 'wait';
  return 'ready';
}
