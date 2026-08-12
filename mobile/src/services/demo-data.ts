import type { ScioData, YouTubeVideoResource } from '../types/scio';

function youtubeVideo(
  language: YouTubeVideoResource['language'],
  youtubeId: string,
  title: string,
  provider: string,
  durationMinutes: number,
): YouTubeVideoResource {
  return {
    kind: 'video',
    language,
    title,
    provider,
    youtubeId,
    url: `https://www.youtube.com/watch?v=${youtubeId}`,
    embedUrl: `https://www.youtube-nocookie.com/embed/${youtubeId}`,
    durationMinutes,
  };
}

export const demoData: ScioData = {
  curriculum: {
    learnerName: 'Camille',
    course: {
      id: 'clear-thinking',
      title: { fr: 'Penser avec clarté', en: 'Thinking with clarity' },
      description: {
        fr: 'Des outils concrets pour mieux raisonner, décider et apprendre.',
        en: 'Practical tools for reasoning, deciding and learning more effectively.',
      },
      modules: [
        {
          id: 'foundations',
          title: { fr: 'Fondations', en: 'Foundations' },
          lessons: [
            {
              id: 'recognize-bias',
              title: { fr: 'Apprendre efficacement', en: 'Learn effectively' },
              summary: {
                fr: 'Comparer les techniques d’étude et distinguer familiarité et maîtrise.',
                en: 'Compare study techniques and distinguish familiarity from mastery.',
              },
              durationMinutes: 11,
              videos: {
                fr: youtubeVideo('fr', 'RVB3PBPxMWg', 'MIEUX APPRENDRE & ÉTUDIER', 'ScienceEtonnante', 29),
                en: youtubeVideo('en', 'NNnIGh9g6fA', 'Human Behavioral Biology — Introduction', 'Stanford / Robert Sapolsky', 57),
              },
            },
            {
              id: 'better-questions',
              title: { fr: 'Tester un principe moral', en: 'Test a moral principle' },
              summary: {
                fr: 'Faire varier un dilemme pour vérifier la cohérence d’un raisonnement.',
                en: 'Vary a dilemma to test whether a line of reasoning stays coherent.',
              },
              durationMinutes: 12,
              videos: {
                fr: youtubeVideo('fr', 'AZBDMN5wZ-8', "Jusqu'où serez-vous utilitariste ?", 'Monsieur Phi avec Science4All', 18),
                en: youtubeVideo('en', 'kBdfcR-8hEY', 'Justice — The Moral Side of Murder', 'Harvard / Michael Sandel', 55),
              },
            },
          ],
        },
        {
          id: 'decisions',
          title: { fr: 'Décisions', en: 'Decisions' },
          lessons: [
            {
              id: 'evaluate-evidence',
              title: { fr: 'Ce qu’une donnée établit', en: 'What data establish' },
              summary: {
                fr: 'Distinguer observation, mécanisme supposé et jugement de valeur.',
                en: 'Separate observations, proposed mechanisms, and value judgments.',
              },
              durationMinutes: 7,
              videos: {
                fr: youtubeVideo('fr', 'alUdFdpAXEc', "Les Essentiels : qu'est-ce que l'économie ?", 'Faculté des Sciences économiques et de gestion de Strasbourg', 10),
                en: youtubeVideo('en', 'fxxPfvicZPU', 'The Economy — The Big Idea', 'CORE Econ / Wendy Carlin', 7),
              },
            },
            {
              id: 'uncertainty',
              title: {
                fr: 'Modéliser pour décider',
                en: 'Model before deciding',
              },
              summary: {
                fr: 'Simplifier un phénomène pour produire une prédiction que l’on peut tester.',
                en: 'Simplify a phenomenon to produce a prediction that can be tested.',
              },
              durationMinutes: 13,
              videos: {
                fr: youtubeVideo('fr', 'K4XS5biheDI', 'Introduction à la mécanique en L1 — cours 1', 'Richard Taillet', 76),
                en: youtubeVideo('en', 'ApUFtLCrU90', 'The Theoretical Minimum — Classical Mechanics', 'Stanford / Leonard Susskind', 89),
              },
            },
          ],
        },
      ],
    },
  },
  exercises: [
    {
      id: 'change-your-mind',
      question: {
        fr: 'Quel réflexe améliore le plus une décision complexe ?',
        en: 'Which habit most improves a complex decision?',
      },
      options: [
        {
          id: 'a',
          label: {
            fr: 'Chercher uniquement les faits rassurants',
            en: 'Only look for reassuring facts',
          },
        },
        {
          id: 'b',
          label: {
            fr: 'Formuler ce qui ferait changer d’avis',
            en: 'State what would change your mind',
          },
        },
        {
          id: 'c',
          label: {
            fr: 'Décider plus vite que les autres',
            en: 'Decide faster than everyone else',
          },
        },
      ],
      correctOptionId: 'b',
      hint: {
        fr: 'Une bonne méthode permet de réviser honnêtement son jugement.',
        en: 'A sound method lets you revise your judgment honestly.',
      },
    },
  ],
  cards: [
    {
      id: 'confirmation-bias',
      front: {
        fr: 'Qu’est-ce qu’un biais de confirmation ?',
        en: 'What is confirmation bias?',
      },
      back: {
        fr: 'La tendance à privilégier les informations qui confortent une croyance existante.',
        en: 'The tendency to favor information that supports an existing belief.',
      },
      dueAt: '2026-08-10T09:00:00.000Z',
    },
    {
      id: 'falsifiability',
      front: {
        fr: 'Pourquoi demander « qu’est-ce qui me ferait changer d’avis » ?',
        en: 'Why ask “what would change my mind”?',
      },
      back: {
        fr: 'Pour rendre une croyance testable et éviter de la protéger contre toute preuve contraire.',
        en: 'To make a belief testable and avoid shielding it from contrary evidence.',
      },
      dueAt: '2026-08-10T09:00:00.000Z',
    },
  ],
  progress: {
    completedLessonIds: [],
    passedExerciseIds: [],
    recalledCardIds: [],
    weeklyLessons: 0,
    weeklyReviews: 0,
  },
};
