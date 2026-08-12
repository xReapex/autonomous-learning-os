import { describe, expect, it } from 'vitest';

import {
  courseGenerationReducer,
  idleCourseGeneration,
  type CourseGenerationInput,
} from './course-generation-state';
import type { ScioData } from '@/types/scio';

const input: CourseGenerationInput = { requestId: 'request-1', jobId: null, locale: 'fr' };
const proposal = { curriculum: { learnerName: 'Lina' } } as ScioData;

describe('course generation state', () => {
  it('starts one background task and ignores a concurrent start', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    expect(running).toMatchObject({ status: 'running', input });
    expect(courseGenerationReducer(running, {
      type: 'start',
      input: { ...input, requestId: 'request-2' },
    })).toBe(running);
  });

  it('publishes only the proposal produced by the active request', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    expect(courseGenerationReducer(running, {
      type: 'succeed',
      requestId: 'stale-request',
      proposal,
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'succeed',
      requestId: input.requestId,
      proposal,
    })).toEqual({ status: 'ready', input, proposal });
  });

  it('attache le job durable uniquement à la requête active', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    const jobId = `job_${'a'.repeat(32)}`;
    expect(courseGenerationReducer(running, { type: 'attach', requestId: 'stale', jobId })).toBe(running);
    expect(courseGenerationReducer(running, { type: 'attach', requestId: input.requestId, jobId }))
      .toMatchObject({ status: 'running', input: { jobId } });
  });

  it('keeps retry input after failure and never invents a proposal', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    expect(courseGenerationReducer(running, {
      type: 'fail',
      requestId: input.requestId,
      error: 'network',
    })).toEqual({ status: 'error', input, error: 'network' });
  });

  it('clears every proposal and error explicitly', () => {
    const ready = { status: 'ready', input, proposal } as const;
    expect(courseGenerationReducer(ready, { type: 'clear' })).toBe(idleCourseGeneration);
  });
});
