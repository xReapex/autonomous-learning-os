export async function runAccountAction(action: () => Promise<void>): Promise<'success' | 'error'> {
  try {
    await action();
    return 'success';
  } catch {
    return 'error';
  }
}

export async function finalizeConfirmedAccountAction(input: {
  remoteAction: () => Promise<void>;
  localCleanup: (() => Promise<void>)[];
}): Promise<void> {
  await input.remoteAction();
  await Promise.allSettled(input.localCleanup.map((cleanup) => cleanup()));
}
