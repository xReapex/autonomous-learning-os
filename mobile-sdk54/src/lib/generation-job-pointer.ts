import type { Locale } from './i18n';

export const generationJobStorageKey = 'scio:generation-job';

export type GenerationJobPointer = {
  jobId: string;
  requestId: string;
  locale: Locale;
};

export type GenerationJobJournal =
  | { phase: 'creating'; requestId: string; locale: Locale }
  | ({ phase: 'attached' } & GenerationJobPointer);

const jobIdPattern = /^job_[a-f0-9]{32}$/;
const requestIdPattern = /^generation-[A-Za-z0-9._:-]{12,180}$/;

export function parseGenerationJobPointer(raw: string | null): GenerationJobPointer | null {
  if (!raw || raw.length > 512) return null;
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 3) return null;
    if (
      typeof value.jobId !== 'string' || !jobIdPattern.test(value.jobId) ||
      typeof value.requestId !== 'string' || !requestIdPattern.test(value.requestId) ||
      (value.locale !== 'fr' && value.locale !== 'en')
    ) return null;
    return { jobId: value.jobId, requestId: value.requestId, locale: value.locale };
  } catch {
    return null;
  }
}

export function serializeGenerationJobPointer(pointer: GenerationJobPointer): string {
  const parsed = parseGenerationJobPointer(JSON.stringify(pointer));
  if (!parsed) throw new Error('invalid_generation_job_pointer');
  return JSON.stringify(parsed);
}

export function parseGenerationJobJournal(raw: string | null): GenerationJobJournal | null {
  if (!raw || raw.length > 512) return null;
  const legacy = parseGenerationJobPointer(raw);
  if (legacy) return { phase: 'attached', ...legacy };
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    if (
      value.phase === 'creating' && Object.keys(value).length === 3 &&
      typeof value.requestId === 'string' && requestIdPattern.test(value.requestId) &&
      (value.locale === 'fr' || value.locale === 'en')
    ) return { phase: 'creating', requestId: value.requestId, locale: value.locale };
    if (value.phase === 'attached' && Object.keys(value).length === 4) {
      const pointer = parseGenerationJobPointer(JSON.stringify({
        jobId: value.jobId,
        requestId: value.requestId,
        locale: value.locale,
      }));
      return pointer ? { phase: 'attached', ...pointer } : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function serializeCreatingGenerationJob(input: {
  requestId: string;
  locale: Locale;
}): string {
  const value = { phase: 'creating' as const, ...input };
  if (!parseGenerationJobJournal(JSON.stringify(value))) throw new Error('invalid_generation_job_journal');
  return JSON.stringify(value);
}

export function serializeAttachedGenerationJob(pointer: GenerationJobPointer): string {
  const value = { phase: 'attached' as const, ...pointer };
  if (!parseGenerationJobJournal(JSON.stringify(value))) throw new Error('invalid_generation_job_journal');
  return JSON.stringify(value);
}
