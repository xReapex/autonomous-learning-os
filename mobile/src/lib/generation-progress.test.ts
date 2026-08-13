import { describe, expect, it } from 'vitest';

import {
  advanceInterviewProgress,
  resolveDurableGenerationProgress,
  resolveInterviewProgress,
} from './generation-progress';

describe('présentation de la progression de génération', () => {
  it('utilise la progression réellement rapportée pendant l’entretien', () => {
    expect(resolveInterviewProgress('starting', 0, true)).toEqual({
      icon: 'messages',
      progress: null,
      statusKey: 'generation.interview.starting.status',
      titleKey: 'generation.interview.starting.title',
      step: 1,
      totalSteps: 5,
    });
    expect(resolveInterviewProgress('question', 37)).toEqual({
      icon: 'messages',
      progress: 37,
      statusKey: 'generation.interview.question.status',
      titleKey: 'generation.interview.question.title',
      step: 1,
      totalSteps: 5,
    });
    expect(resolveInterviewProgress('question', 37, true)).toEqual({
      icon: 'messages',
      progress: 37,
      statusKey: 'generation.interview.generating.status',
      titleKey: 'generation.interview.generating.title',
      step: 1,
      totalSteps: 5,
    });
    expect(resolveInterviewProgress('confirmation', 72)).toEqual({
      icon: 'brief-check',
      progress: 72,
      statusKey: 'generation.interview.confirmation.status',
      titleKey: 'generation.interview.confirmation.title',
      step: 2,
      totalSteps: 5,
    });
  });

  it('borne la mesure serveur sans inventer une pondération globale', () => {
    expect(resolveInterviewProgress('question', -5).progress).toBe(0);
    expect(resolveInterviewProgress('question', 140).progress).toBe(100);
    expect(resolveInterviewProgress('confirmation', -5).progress).toBe(0);
    expect(resolveInterviewProgress('confirmation', 140).progress).toBe(100);
  });

  it('ne fait jamais régresser la progression serveur observée', () => {
    expect(advanceInterviewProgress(80, 20)).toBe(80);
    expect(advanceInterviewProgress(20, 80)).toBe(80);
    expect(advanceInterviewProgress(80, 140)).toBe(100);
    expect(advanceInterviewProgress(20, -10)).toBe(20);
  });

  it('présente les statuts durables comme des jalons explicites', () => {
    expect(resolveDurableGenerationProgress('submitting')).toEqual({
      icon: 'send', progress: null, statusKey: 'generation.phase.submitting.status',
      titleKey: 'generation.phase.submitting.title', bodyKey: 'generation.phase.submitting.body',
      step: 3, totalSteps: 5,
    });
    expect(resolveDurableGenerationProgress('queued')).toEqual({
      icon: 'clock', progress: null, statusKey: 'generation.phase.queued.status',
      titleKey: 'generation.phase.queued.title', bodyKey: 'generation.phase.queued.body',
      step: 3, totalSteps: 5,
    });
    expect(resolveDurableGenerationProgress('building')).toEqual({
      icon: 'book-build', progress: null, statusKey: 'generation.phase.building.status',
      titleKey: 'generation.phase.building.title', bodyKey: 'generation.phase.building.body',
      step: 4, totalSteps: 5,
    });
  });
});
