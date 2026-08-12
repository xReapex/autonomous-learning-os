export async function commitAfterDurableMutation(
  mutate: () => Promise<boolean>,
  commit: () => void | Promise<unknown>,
): Promise<boolean> {
  const durable = await mutate();
  if (!durable) return false;
  await commit();
  return true;
}
