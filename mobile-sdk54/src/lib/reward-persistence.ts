import type { RewardResult } from './rewards';

export async function publishPersistedReward(
  result: RewardResult,
  persist: (result: RewardResult) => Promise<void>,
  publish: (result: RewardResult) => void,
): Promise<void> {
  await persist(result);
  publish(result);
}
