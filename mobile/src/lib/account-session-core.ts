export const localSessionDataKeys = [
  'scio:data-cache',
  'scio:generated-data',
  'scio:rewards',
  'scio:generation-job',
] as const;

export type ClearLocalSessionDependencies = {
  clearSession: () => Promise<void>;
  removeStorage: (keys: readonly string[]) => Promise<void>;
};

export async function settleSessionCleanup(operations: (() => Promise<void>)[]): Promise<void> {
  const results = await Promise.allSettled(operations.map((operation) => Promise.resolve().then(operation)));
  if (results.some((result) => result.status === 'rejected')) {
    throw new Error('auth_local_cleanup_failed');
  }
}

export async function clearLocalSessionData(
  dependencies: ClearLocalSessionDependencies,
): Promise<void> {
  await settleSessionCleanup([
    dependencies.clearSession,
    () => dependencies.removeStorage(localSessionDataKeys),
  ]);
}
