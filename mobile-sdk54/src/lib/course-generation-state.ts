import type { Locale } from './i18n';
import type { ScioData } from '@/types/scio';

export type CourseGenerationError = 'configuration' | 'unauthorized' | 'busy' | 'network' | 'invalid' | 'expired';

export type CourseGenerationInput = {
  requestId: string;
  locale: Locale;
  jobId: string | null;
};

export type CourseGenerationState =
  | { status: 'idle' }
  | { status: 'running'; input: CourseGenerationInput }
  | { status: 'ready'; input: CourseGenerationInput; proposal: ScioData }
  | { status: 'error'; input: CourseGenerationInput; error: CourseGenerationError };

export type CourseGenerationAction =
  | { type: 'start'; input: CourseGenerationInput }
  | { type: 'attach'; requestId: string; jobId: string }
  | { type: 'succeed'; requestId: string; proposal: ScioData }
  | { type: 'fail'; requestId: string; error: CourseGenerationError }
  | { type: 'clear' };

export const idleCourseGeneration: CourseGenerationState = { status: 'idle' };

export function courseGenerationReducer(
  state: CourseGenerationState,
  action: CourseGenerationAction,
): CourseGenerationState {
  if (action.type === 'clear') return idleCourseGeneration;
  if (action.type === 'start') {
    return state.status === 'running' ? state : { status: 'running', input: action.input };
  }
  if (state.status !== 'running' || state.input.requestId !== action.requestId) return state;
  if (action.type === 'attach') {
    return { status: 'running', input: { ...state.input, jobId: action.jobId } };
  }
  if (action.type === 'succeed') {
    return { status: 'ready', input: state.input, proposal: action.proposal };
  }
  return { status: 'error', input: state.input, error: action.error };
}
