import { describe, expect, it } from 'vitest';

import { demoData } from '../services/demo-data';
import { parseCardsDto, parseCurriculumDto, parseProgressDto, parseScioDataDto } from './dto-validation';

describe('mobile API DTO validation', () => {
  it('accepts the complete demo DTO', () => {
    expect(parseScioDataDto(demoData)).toEqual(demoData);
    expect(parseCurriculumDto(demoData.curriculum)).toEqual(demoData.curriculum);
    expect(parseCardsDto(demoData.cards)).toEqual(demoData.cards);
    expect(parseProgressDto(demoData.progress)).toEqual(demoData.progress);
  });

  it('rejects the incompatible desktop curriculum envelope', () => {
    expect(() => parseCurriculumDto({ revision: 'abc', document: { subject: 'cuisine' } })).toThrow(
      'DTO_CURRICULUM_INVALID',
    );
  });

  it('rejects malformed progress, cards and non-YouTube curriculum resources', () => {
    expect(() => parseProgressDto({ completedLessonIds: 'lesson-1' })).toThrow('DTO_PROGRESS_INVALID');
    expect(() => parseCardsDto([{ id: 'card-without-content' }])).toThrow('DTO_CARDS_INVALID');

    const invalid = structuredClone(demoData.curriculum);
    invalid.course.modules[0].lessons[0].videos.fr!.url = 'https://example.com/reading';
    expect(() => parseCurriculumDto(invalid)).toThrow('DTO_CURRICULUM_INVALID');
  });
});
