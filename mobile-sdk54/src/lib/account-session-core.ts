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

export async function clearLocalSessionData(
  dependencies: ClearLocalSessionDependencies,
): Promise<void> {
  await Promise.all([
    dependencies.clearSession(),
    dependencies.removeStorage(localSessionDataKeys),
  ]);
}
