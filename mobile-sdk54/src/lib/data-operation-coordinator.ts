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

    commit(operation: OperationId, publish: () => true): Promise<boolean> {
      const task = () => {
        if (operation !== currentOperation) return false;
        publish();
        return true;
      };
      const result = commitQueue.then(task, task);
      commitQueue = result.then(() => undefined, () => undefined);
      return result;
    },

    commitPrepared(
      operation: OperationId,
      prepare: () => Promise<void>,
      publish: () => true,
      rollback: () => Promise<void>,
    ): Promise<boolean> {
      const task = async () => {
        if (operation !== currentOperation) return false;
        try {
          await prepare();
        } catch (error) {
          await rollback();
          throw error;
        }
        if (operation !== currentOperation) {
          await rollback();
          return false;
        }
        publish();
        return true;
      };
      const result = commitQueue.then(task, task);
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
