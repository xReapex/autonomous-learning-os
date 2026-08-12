export type MutationRun<T> =
  | { started: false }
  | { started: true; value: T };

export function createMutationLock() {
  let active = false;

  return {
    async run<T>(task: () => Promise<T>): Promise<MutationRun<T>> {
      if (active) return { started: false };
      active = true;
      try {
        return { started: true, value: await task() };
      } finally {
        active = false;
      }
    },
  };
}
