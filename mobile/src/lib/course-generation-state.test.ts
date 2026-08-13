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

  it('reprend un job attaché directement à l’étape de file d’attente', () => {
    const attached = { ...input, jobId: `job_${'a'.repeat(32)}` };
    expect(courseGenerationReducer(idleCourseGeneration, { type: 'start', input: attached }))
      .toEqual({ status: 'running', input: attached, phase: 'queued' });
  });

  it('publishes only the proposal produced by the active request', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    expect(courseGenerationReducer(running, {
      type: 'succeed',
      requestId: 'stale-request',
      jobId: null,
      proposal,
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'succeed',
      requestId: input.requestId,
      jobId: null,
      proposal,
    })).toEqual({ status: 'ready', input, proposal });
  });

  it('impose l’identité du job sur les transitions terminales', () => {
    const jobId = `job_${'a'.repeat(32)}`;
    const wrongJobId = `job_${'b'.repeat(32)}`;
    const submitting = courseGenerationReducer(idleCourseGeneration, {
      type: 'start', input,
    });
    const running = courseGenerationReducer(submitting, {
      type: 'attach', requestId: input.requestId, jobId,
    });
    expect(running).toMatchObject({ status: 'running', input: { jobId }, phase: 'queued' });
    expect(courseGenerationReducer(running, {
      type: 'attach', requestId: input.requestId, jobId,
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'attach', requestId: input.requestId, jobId: wrongJobId,
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'succeed', requestId: input.requestId, jobId: wrongJobId, proposal,
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'fail', requestId: input.requestId, jobId: wrongJobId, error: 'network',
    })).toBe(running);
    expect(courseGenerationReducer(running, {
      type: 'succeed', requestId: input.requestId, jobId, proposal,
    })).toEqual({ status: 'ready', input: { ...input, jobId }, proposal });
  });

  it('expose les jalons durables sans régression ni publication obsolète', () => {
    const submitting = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    const jobId = `job_${'a'.repeat(32)}`;
    expect(submitting).toMatchObject({ status: 'running', phase: 'submitting', input });
    expect(courseGenerationReducer(submitting, {
      type: 'observe', requestId: 'stale', jobId, jobStatus: 'queued',
    })).toBe(submitting);

    const queued = courseGenerationReducer(submitting, {
      type: 'observe', requestId: input.requestId, jobId, jobStatus: 'queued',
    });
    expect(queued).toMatchObject({ status: 'running', phase: 'queued', input: { jobId } });
    expect(courseGenerationReducer(queued, {
      type: 'observe',
      requestId: input.requestId,
      jobId: `job_${'b'.repeat(32)}`,
      jobStatus: 'running',
    })).toBe(queued);

    const building = courseGenerationReducer(queued, {
      type: 'observe', requestId: input.requestId, jobId, jobStatus: 'running',
    });
    expect(building).toMatchObject({ status: 'running', phase: 'building', input: { jobId } });
    expect(courseGenerationReducer(building, {
      type: 'observe', requestId: input.requestId, jobId, jobStatus: 'queued',
    })).toBe(building);
  });

  it('keeps retry input after failure and never invents a proposal', () => {
    const running = courseGenerationReducer(idleCourseGeneration, { type: 'start', input });
    expect(courseGenerationReducer(running, {
      type: 'fail',
      requestId: input.requestId,
      jobId: null,
      error: 'network',
    })).toEqual({ status: 'error', input, error: 'network' });
  });

  it('clears every proposal and error explicitly', () => {
    const ready = { status: 'ready', input, proposal } as const;
    expect(courseGenerationReducer(ready, { type: 'clear' })).toBe(idleCourseGeneration);
  });
});
