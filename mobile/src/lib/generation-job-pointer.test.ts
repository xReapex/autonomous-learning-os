import { describe, expect, it } from 'vitest';

import {
  parseGenerationJobJournal,
  parseGenerationJobPointer,
  serializeCreatingGenerationJob,
  serializeGenerationJobPointer,
} from './generation-job-pointer';

const pointer = {
  jobId: `job_${'a'.repeat(32)}`,
  requestId: 'generation-1723456789000-1',
  locale: 'fr' as const,
};

describe('pointeur local de génération', () => {
  it('persiste uniquement les identifiants nécessaires à la reprise', () => {
    const raw = serializeGenerationJobPointer(pointer);
    expect(JSON.parse(raw)).toEqual(pointer);
    expect(raw).not.toContain('stateToken');
    expect(raw).not.toContain('payload');
    expect(parseGenerationJobPointer(raw)).toEqual(pointer);
  });

  it('journalise la création avant le POST sans conserver le state signé', () => {
    const raw = serializeCreatingGenerationJob({ requestId: pointer.requestId, locale: pointer.locale });
    expect(JSON.parse(raw)).toEqual({ phase: 'creating', requestId: pointer.requestId, locale: pointer.locale });
    expect(raw).not.toContain('stateToken');
    expect(parseGenerationJobJournal(raw)).toEqual({
      phase: 'creating',
      requestId: pointer.requestId,
      locale: pointer.locale,
    });
  });

  it('normalise un ancien pointeur attaché pour préserver les reprises existantes', () => {
    expect(parseGenerationJobJournal(JSON.stringify(pointer))).toEqual({ phase: 'attached', ...pointer });
  });

  it.each([
    '',
    '{}',
    JSON.stringify({ ...pointer, stateToken: 'secret' }),
    JSON.stringify({ ...pointer, jobId: '../shared' }),
    JSON.stringify({ ...pointer, locale: 'de' }),
    JSON.stringify({ ...pointer, requestId: 'short' }),
  ])('rejette les pointeurs invalides ou enrichis: %s', (raw) => {
    expect(parseGenerationJobPointer(raw)).toBeNull();
  });
});
