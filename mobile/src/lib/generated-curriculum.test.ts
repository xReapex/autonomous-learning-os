import { describe, expect, it } from 'vitest';

import { convertGeneratedCurriculum } from './generated-curriculum';

const document = {
  version: 1,
  subject: 'La guitare jazz',
  goal: 'Jouer un standard simple.',
  level: 'debutant',
  sessionMinutes: 30,
  generatedAt: '2026-08-11',
  language: 'fr',
  subjects: [
    {
      id: 'harmony',
      icon: 'music',
      title: 'Harmonie',
      level: 'Fondations',
      lessons: [
        {
          id: 'ii-v-i',
          title: 'Le II-V-I',
          objective: 'Reconnaître la cadence.',
          keyTakeaways: ['Trois accords', 'Résolution tonale'],
          prompt: 'Joue la cadence dans deux tonalités.',
          source: {
            title: 'Comprendre le II V I',
            provider: 'Cours de guitare',
            kind: 'video',
            language: 'fr',
            url: 'https://www.youtube.com/watch?v=abcdefghijk',
            embedUrl: 'https://www.youtube-nocookie.com/embed/abcdefghijk',
            totalMinutes: 14,
            minutes: 9,
            why: 'Démonstration progressive.',
            access: 'free',
            accessNote: 'Public',
            verifiedAt: '2026-08-11',
            segmentLabel: 'Cadence complète',
          },
        },
      ],
    },
  ],
  cards: [1, 2, 3].map((index) => ({
    id: `card-${index}`,
    type: 'Harmonie',
    front: `Question ${index}`,
    back: `Réponse ${index}`,
    subjectId: 'harmony',
    lessonId: 'ii-v-i',
  })),
};

describe('generated curriculum conversion', () => {
  it('construit un parcours local dans la langue générée uniquement', () => {
    const result = convertGeneratedCurriculum(document, 'fr');
    expect(result.curriculum.course.language).toBe('fr');
    expect(result.curriculum.course.title.fr).toBe('La guitare jazz');
    expect(result.curriculum.course.modules[0].lessons[0].videos.fr?.youtubeId).toBe('abcdefghijk');
    expect(result.curriculum.course.modules[0].lessons[0].videos.en).toBeUndefined();
    expect(result.cards).toHaveLength(3);
    expect(result.exercises).toHaveLength(3);
    expect(result.exercises[0]).toMatchObject({
      id: 'exercise:card-1',
      correctOptionId: 'exercise:card-1:correct',
    });
    expect(result.exercises[0].options).toHaveLength(3);
    expect(result.exercises[0].options.find(({ id }) => id === result.exercises[0].correctOptionId)?.label.fr)
      .toBe('Réponse 1');
  });

  it('refuse une langue de document ou de source différente', () => {
    expect(() => convertGeneratedCurriculum({ ...document, language: 'en' }, 'fr')).toThrow(/language/i);
    const wrongSource = structuredClone(document);
    wrongSource.subjects[0].lessons[0].source.language = 'en';
    expect(() => convertGeneratedCurriculum(wrongSource, 'fr')).toThrow(/language/i);
  });

  it('refuse les URLs non YouTube et les références de carte cassées', () => {
    const unsafe = structuredClone(document);
    unsafe.subjects[0].lessons[0].source.url = 'https://example.com/video';
    expect(() => convertGeneratedCurriculum(unsafe, 'fr')).toThrow(/youtube/i);

    const broken = structuredClone(document);
    broken.cards[0].lessonId = 'missing';
    expect(() => convertGeneratedCurriculum(broken, 'fr')).toThrow(/reference/i);
  });
});
