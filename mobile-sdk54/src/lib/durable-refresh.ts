export type DurableRefreshResult = {
  durable: boolean;
  refreshed: boolean;
};

export async function mutateThenRefresh(
  mutate: () => Promise<boolean>,
  refresh: () => Promise<boolean>,
): Promise<DurableRefreshResult> {
  const durable = await mutate();
  if (!durable) return { durable: false, refreshed: false };
  return { durable: true, refreshed: await refresh() };
}
