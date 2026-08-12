import { join } from 'node:path';

import { createDurableJobStore } from '../../../worker/durable-job-store.mjs';
import { createMobileGenerationJobHandlers } from './mobile-generation-job-handlers';
import { scioAuthStoreFromEnvironment } from './scio-auth';

export function scioGenerationJobStoreFromEnvironment() {
  const baseDirectory = process.env.LEARNING_DATA_DIR?.trim() || join(process.cwd(), '.data');
  const directory = process.env.SCIO_GENERATION_JOBS_DIR?.trim() || join(baseDirectory, 'scio-generation-jobs');
  return createDurableJobStore({
    directory,
    maxActivePerUser: Number(process.env.SCIO_GENERATION_MAX_ACTIVE_PER_USER || '2'),
    maxTotalJobs: Number(process.env.SCIO_GENERATION_MAX_TOTAL_JOBS || '1000'),
  });
}

export function mobileGenerationJobHandlersFromEnvironment() {
  return createMobileGenerationJobHandlers({
    auth: scioAuthStoreFromEnvironment(),
    jobs: scioGenerationJobStoreFromEnvironment(),
  });
}
