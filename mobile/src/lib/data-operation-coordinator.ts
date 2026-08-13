type OperationId = number;

export function createDataOperationCoordinator() {
  let currentOperation = 0;
  let commitQueue: Promise<unknown> = Promise.resolve();
  let mutationQueue: Promise<unknown> = Promise.resolve();

  return {
    start(): OperationId {
      currentOperation += 1;
      return currentOperation;
    },

    isCurrent(operation: OperationId): boolean {
      return operation === currentOperation;
    },

    commit(operation: OperationId, write: () => Promise<void>): Promise<boolean> {
      const task = async () => {
        if (operation !== currentOperation) return false;
        await write();
        return operation === currentOperation;
      };
      const result = commitQueue.then(task, task);
      commitQueue = result.then(() => undefined, () => undefined);
      return result;
    },

    commitLatest(write: () => Promise<void>): Promise<void> {
      const result = commitQueue.then(write, write);
      commitQueue = result.then(() => undefined, () => undefined);
      return result;
    },

    runMutation<T>(mutation: () => Promise<T>): Promise<T> {
      const result = mutationQueue.then(mutation, mutation);
      mutationQueue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
}
