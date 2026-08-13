type Coordinator = {
  start: () => number;
  isCurrent: (operation: number) => boolean;
  commit: (operation: number, publish: () => true) => Promise<boolean>;
  runMutation: <T>(mutation: () => Promise<T>) => Promise<T>;
};

type Dependencies = {
  coordinator: Coordinator;
  mutate: () => Promise<void>;
  onFailure: (error: unknown) => void;
};

export function runCoordinatedSync({
  coordinator,
  mutate,
  onFailure,
}: Dependencies): Promise<boolean> {
  return coordinator.runMutation(async () => {
    const operation = coordinator.start();
    try {
      await mutate();
      return true;
    } catch (error) {
      if (coordinator.isCurrent(operation)) {
        await coordinator.commit(operation, () => {
          onFailure(error);
          return true;
        });
      }
      return false;
    }
  });
}
