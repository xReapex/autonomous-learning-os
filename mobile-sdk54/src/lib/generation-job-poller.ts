import type { GenerationJob } from './generation-job-api';

type PollDependencies = {
  get: (jobId: string) => Promise<GenerationJob>;
  wait?: (milliseconds: number) => Promise<void>;
  isCancelled: () => boolean;
};

const defaultWait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function pollGenerationJob(
  jobId: string,
  dependencies: PollDependencies,
): Promise<GenerationJob | null> {
  const wait = dependencies.wait ?? defaultWait;
  let delayMs = 1_000;
  while (!dependencies.isCancelled()) {
    const job = await dependencies.get(jobId);
    if (job.status !== 'queued' && job.status !== 'running') return job;
    await wait(delayMs);
    delayMs = Math.min(Math.round(delayMs * 1.5), 5_000);
  }
  return null;
}
