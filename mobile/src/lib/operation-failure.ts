type Coordinator = {
  isCurrent: (operation: number) => boolean;
  commit: (operation: number, publish: () => true) => Promise<boolean>;
};

export async function commitOperationFailure(
  coordinator: Coordinator,
  operation: number,
  publish: () => void,
): Promise<boolean> {
  if (!coordinator.isCurrent(operation)) return false;
  return coordinator.commit(operation, () => {
    publish();
    return true;
  });
}
