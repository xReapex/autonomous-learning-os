export type DurableGenerationJob = {
  id: string;
  userId: string;
  idempotencyHash: string;
  payloadHash: string;
  payload: import('../app/src/lib/curriculum-interview').InterviewRequest;
  status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';
  attempts: number;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  output: unknown | null;
  error: { category: string } | null;
};

export type DurableJobStore = {
  create(input: { userId: string; idempotencyKey: string; payload: import('../app/src/lib/curriculum-interview').InterviewRequest }): Promise<{ job: DurableGenerationJob; replayed: boolean }>;
  get(userId: string, jobId: string): Promise<DurableGenerationJob | null>;
  getByIdempotencyKey(userId: string, idempotencyKey: string): Promise<DurableGenerationJob | null>;
  getById(jobId: string): Promise<DurableGenerationJob | null>;
  claimNext(): Promise<DurableGenerationJob | null>;
  recoverInterrupted(): Promise<number>;
  cancel(userId: string, jobId: string): Promise<DurableGenerationJob | null>;
  succeed(jobId: string, output: object): Promise<boolean>;
  fail(jobId: string, category: string): Promise<boolean>;
  acknowledge(userId: string, jobId: string): Promise<boolean>;
  deleteUserJobs(userId: string): Promise<number>;
};

export class DurableJobStoreError extends Error {
  code: string;
}

export function createDurableJobStore(options: {
  directory: string;
  maxActivePerUser?: number;
  maxTotalJobs?: number;
  maxPayloadBytes?: number;
  maxOutputBytes?: number;
  maxAttempts?: number;
  terminalRetentionMs?: number;
  now?: () => Date;
}): DurableJobStore;
