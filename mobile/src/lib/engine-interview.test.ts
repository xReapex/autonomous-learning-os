import { describe, expect, it } from 'vitest';

import { parseEngineInterviewResponse } from './engine-interview';

const state = 's'.repeat(40);

it('accepte trois à cinq choix IA distincts sur une question', () => {
  const response = parseEngineInterviewResponse({
    phase: 'question',
    message: 'Que sais-tu déjà faire concrètement dans ce domaine ?',
    choices: ['Je débute complètement', 'Je connais quelques bases', 'Je peux tenir une conversation simple'],
    progress: 30,
    document: null,
    state,
  });
  expect(response.phase).toBe('question');
  if (response.phase === 'question') expect(response.choices).toHaveLength(3);
});

describe('choix IA fail-closed', () => {
  it('refuse une question sans choix ou avec doublons', () => {
    expect(() => parseEngineInterviewResponse({ phase: 'question', message: 'Question', progress: 20, document: null, state })).toThrow('INVALID_ENGINE_RESPONSE');
    expect(() => parseEngineInterviewResponse({
      phase: 'question', message: 'Question', choices: ['Débutant', 'Débutant', 'Avancé'], progress: 20, document: null, state,
    })).toThrow('INVALID_ENGINE_RESPONSE');
  });

  it('exige un tableau vide hors question', () => {
    expect(parseEngineInterviewResponse({ phase: 'confirmation', message: 'Résumé', choices: [], progress: 90, document: null, state }).phase).toBe('confirmation');
    expect(() => parseEngineInterviewResponse({ phase: 'confirmation', message: 'Résumé', choices: ['Oui'], progress: 90, document: null, state })).toThrow('INVALID_ENGINE_RESPONSE');
  });
});
