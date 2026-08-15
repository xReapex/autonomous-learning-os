export type ExpiredSessionCleanupResult = 'cleared' | 'failed';

type CleanupOperation = () => Promise<void>;

type ExpiredSessionCleanupCoordinator = {
  ensure: (cleanup: CleanupOperation) => Promise<ExpiredSessionCleanupResult>;
  isRequired: () => boolean;
  require: () => void;
};

export function createExpiredSessionCleanupCoordinator(): ExpiredSessionCleanupCoordinator {
  let active: Promise<ExpiredSessionCleanupResult> | null = null;
  let required = false;
  let requirementVersion = 0;

  return {
    require() {
      required = true;
      requirementVersion += 1;
    },
    isRequired() {
      return required;
    },
    ensure(cleanup) {
      if (!required) return Promise.resolve('cleared');
      if (active) return active;

      const run = (async (): Promise<ExpiredSessionCleanupResult> => {
        while (required) {
          const version = requirementVersion;
          try {
            await cleanup();
          } catch {
            return 'failed';
          }
          if (version === requirementVersion) {
            required = false;
            return 'cleared';
          }
        }
        return 'cleared';
      })();
      const settled = run.finally(() => {
        if (active === settled) active = null;
      });
      active = settled;
      return settled;
    },
  };
}

export async function observeExpiredSessionCleanup(
  cleanup: Promise<ExpiredSessionCleanupResult>,
  timeoutMs: number,
): Promise<ExpiredSessionCleanupResult | 'pending'> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<'pending'>((resolve) => {
    timeout = setTimeout(() => resolve('pending'), timeoutMs);
  });
  try {
    return await Promise.race([cleanup, deadline]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export const expiredSessionCleanupCoordinator = createExpiredSessionCleanupCoordinator();
