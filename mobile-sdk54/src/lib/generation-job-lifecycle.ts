import type { GenerationJob } from './generation-job-api';

export type GenerationJobLifecycleDependencies = {
  cancel: (jobId: string) => Promise<GenerationJob>;
  acknowledge: (jobId: string) => Promise<void>;
  removeLocal: () => Promise<void>;
};

export async function finalizeGenerationJob(
  job: Pick<GenerationJob, 'id' | 'status'>,
  dependencies: GenerationJobLifecycleDependencies,
): Promise<void> {
  const terminal = job.status === 'queued' || job.status === 'running'
    ? await dependencies.cancel(job.id)
    : job;
  if (terminal.status === 'queued' || terminal.status === 'running') {
    throw new Error('generation_job_not_terminal');
  }
  await dependencies.acknowledge(terminal.id);
  await dependencies.removeLocal();
}
