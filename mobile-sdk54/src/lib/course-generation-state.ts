import type { Locale } from './i18n';
import type { ScioData } from '@/types/scio';

export type CourseGenerationError = 'configuration' | 'unauthorized' | 'busy' | 'network' | 'invalid' | 'expired';

export type CourseGenerationInput = {
  requestId: string;
  locale: Locale;
  jobId: string | null;
};

export type CourseGenerationPhase = 'submitting' | 'queued' | 'building';

export type CourseGenerationState =
  | { status: 'idle' }
  | { status: 'running'; input: CourseGenerationInput; phase: CourseGenerationPhase }
  | { status: 'ready'; input: CourseGenerationInput; proposal: ScioData }
  | { status: 'error'; input: CourseGenerationInput; error: CourseGenerationError };

export type CourseGenerationAction =
  | { type: 'start'; input: CourseGenerationInput }
  | { type: 'attach'; requestId: string; jobId: string }
  | { type: 'observe'; requestId: string; jobId: string; jobStatus: 'queued' | 'running' }
  | { type: 'succeed'; requestId: string; jobId: string | null; proposal: ScioData }
  | { type: 'fail'; requestId: string; jobId: string | null; error: CourseGenerationError }
  | { type: 'clear' };

export const idleCourseGeneration: CourseGenerationState = { status: 'idle' };

export function courseGenerationReducer(
  state: CourseGenerationState,
  action: CourseGenerationAction,
): CourseGenerationState {
  if (action.type === 'clear') return idleCourseGeneration;
  if (action.type === 'start') {
    return state.status === 'running'
      ? state
      : { status: 'running', input: action.input, phase: action.input.jobId ? 'queued' : 'submitting' };
  }
  if (state.status !== 'running' || state.input.requestId !== action.requestId) return state;
  if (action.type === 'attach') {
    if (state.input.jobId === action.jobId) return state;
    if (state.input.jobId !== null) return state;
    return { status: 'running', input: { ...state.input, jobId: action.jobId }, phase: 'queued' };
  }
  if (action.type !== 'observe' && action.jobId !== state.input.jobId) return state;
  if (action.type === 'observe') {
    if (state.input.jobId !== null && state.input.jobId !== action.jobId) return state;
    const nextPhase: CourseGenerationPhase = action.jobStatus === 'running' ? 'building' : 'queued';
    if (state.phase === 'building' && nextPhase === 'queued') return state;
    return { status: 'running', input: { ...state.input, jobId: action.jobId }, phase: nextPhase };
  }
  if (action.type === 'succeed') {
    return { status: 'ready', input: state.input, proposal: action.proposal };
  }
  return { status: 'error', input: state.input, error: action.error };
}
