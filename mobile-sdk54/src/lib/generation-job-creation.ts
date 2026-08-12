import type { GenerationJob } from './generation-job-api';
import type { GenerationJobPointer } from './generation-job-pointer';
import type { Locale } from './i18n';

export type GenerationCreationDependencies = {
  persistCreating: (input: { requestId: string; locale: Locale }) => Promise<void>;
  create: (stateToken: string, requestId: string) => Promise<GenerationJob>;
  persistAttached: (pointer: GenerationJobPointer) => Promise<void>;
};

export async function startDurableGeneration(
  input: { stateToken: string; requestId: string; locale: Locale },
  dependencies: GenerationCreationDependencies,
): Promise<GenerationJob> {
  await dependencies.persistCreating({ requestId: input.requestId, locale: input.locale });
  const job = await dependencies.create(input.stateToken, input.requestId);
  await dependencies.persistAttached({
    jobId: job.id,
    requestId: input.requestId,
    locale: input.locale,
  });
  return job;
}
