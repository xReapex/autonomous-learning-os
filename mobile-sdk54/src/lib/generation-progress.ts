import type { AppIconName } from '@/components/app-icon';
import type { TranslationKey } from './i18n';
import type { CourseGenerationPhase } from './course-generation-state';

type ProgressPresentation = {
  icon: AppIconName;
  progress: number | null;
  statusKey: TranslationKey;
  titleKey: TranslationKey;
  step: number;
  totalSteps: 5;
};

export type DurableGenerationProgress = ProgressPresentation & {
  bodyKey: TranslationKey;
};

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));
export const advanceInterviewProgress = (current: number, observed: number) =>
  Math.max(clamp(current), clamp(observed));
export function resolveInterviewProgress(
  phase: 'starting' | 'question' | 'confirmation',
  progress: number,
  busy = false,
): ProgressPresentation {
  if (phase === 'starting') {
    return {
      icon: 'messages',
      progress: null,
      statusKey: 'generation.interview.starting.status',
      titleKey: 'generation.interview.starting.title',
      step: 1,
      totalSteps: 5,
    };
  }
  if (phase === 'confirmation') {
    return {
      icon: 'brief-check',
      progress: clamp(progress),
      statusKey: 'generation.interview.confirmation.status',
      titleKey: 'generation.interview.confirmation.title',
      step: 2,
      totalSteps: 5,
    };
  }
  return {
    icon: 'messages',
    progress: clamp(progress),
    statusKey: busy
      ? 'generation.interview.generating.status'
      : 'generation.interview.question.status',
    titleKey: busy
      ? 'generation.interview.generating.title'
      : 'generation.interview.question.title',
    step: 1,
    totalSteps: 5,
  };
}

const durableProgress: Record<CourseGenerationPhase, DurableGenerationProgress> = {
  submitting: {
    icon: 'send',
    progress: null,
    statusKey: 'generation.phase.submitting.status',
    titleKey: 'generation.phase.submitting.title',
    bodyKey: 'generation.phase.submitting.body',
    step: 3,
    totalSteps: 5,
  },
  queued: {
    icon: 'clock',
    progress: null,
    statusKey: 'generation.phase.queued.status',
    titleKey: 'generation.phase.queued.title',
    bodyKey: 'generation.phase.queued.body',
    step: 3,
    totalSteps: 5,
  },
  building: {
    icon: 'book-build',
    progress: null,
    statusKey: 'generation.phase.building.status',
    titleKey: 'generation.phase.building.title',
    bodyKey: 'generation.phase.building.body',
    step: 4,
    totalSteps: 5,
  },
};

export function resolveDurableGenerationProgress(
  phase: CourseGenerationPhase,
): DurableGenerationProgress {
  return durableProgress[phase];
}
