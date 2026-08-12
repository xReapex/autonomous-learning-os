import { commitAfterDurableMutation } from './durable-mutation';

export async function rewardAfterDurableMutation<Event>(
  mutate: () => Promise<boolean>,
  grant: (event: Event) => Promise<unknown>,
  event: Event,
): Promise<boolean> {
  return commitAfterDurableMutation(mutate, () => grant(event));
}
