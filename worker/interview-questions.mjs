export const QUESTION_TOPIC_NAMES = Object.freeze([
  'subject',
  'current_method',
  'level',
  'goal',
  'availability',
  'horizon',
  'format',
  'constraints',
]);

const OPENING_QUESTIONS = Object.freeze({
  fr: 'Quel sujet précis souhaitez-vous apprendre ?',
  en: 'What exactly do you want to learn?',
});

const MAX_SUBJECT_LABEL_CHARS = 96;

function subjectLabel(transcript) {
  const raw = transcript.find((message) => message?.role === 'user' && typeof message.content === 'string')?.content;
  if (!raw) throw new Error('missing_interview_subject');
  const normalized = raw
    .normalize('NFKC')
    .replace(/["«»“”]/g, ' ')
    .replace(/[\p{Cf}\p{Cc}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) throw new Error('missing_interview_subject');
  const characters = Array.from(normalized);
  return characters.length <= MAX_SUBJECT_LABEL_CHARS
    ? normalized
    : `${characters.slice(0, MAX_SUBJECT_LABEL_CHARS - 1).join('').trimEnd()}…`;
}

const FRENCH_BUILDERS = Object.freeze({
  current_method: (subject) => `Comment apprenez-vous actuellement « ${subject} » ?`,
  level: (subject) => `Que savez-vous déjà expliquer ou appliquer sur « ${subject} » ?`,
  goal: (subject) => `Quel résultat concret souhaitez-vous atteindre en apprenant « ${subject} » ?`,
  availability: (subject) => `Combien de temps pouvez-vous consacrer chaque semaine à « ${subject} » ?`,
  horizon: (subject) => `Quand souhaitez-vous atteindre votre objectif autour de « ${subject} » ?`,
  format: (subject) => `Quel format vous aiderait le plus à progresser sur « ${subject} » ?`,
  constraints: (subject) => `Quelle contrainte dois-je respecter pour construire votre parcours sur « ${subject} » ?`,
});

const ENGLISH_BUILDERS = Object.freeze({
  current_method: (subject) => `How do you currently learn “${subject}”?`,
  level: (subject) => `What can you already explain or apply about “${subject}”?`,
  goal: (subject) => `What concrete outcome do you want to achieve by learning “${subject}”?`,
  availability: (subject) => `How much time can you spend each week on “${subject}”?`,
  horizon: (subject) => `By when do you want to reach your goal for “${subject}”?`,
  format: (subject) => `Which format would help you progress most with “${subject}”?`,
  constraints: (subject) => `What constraint should I respect when building your path for “${subject}”?`,
});

const LEGACY_QUESTION_TOPICS = new Map([
  ['Quel sujet précis veux-tu apprendre ?', 'subject'],
  ['Comment apprends-tu actuellement ce sujet ?', 'current_method'],
  ['Que sais-tu déjà faire concrètement dans ce domaine ?', 'level'],
  ['Quel résultat vérifiable veux-tu atteindre ?', 'goal'],
  ['Quel temps total peux-tu consacrer chaque semaine ?', 'availability'],
  ['À quelle échéance veux-tu atteindre cet objectif ?', 'horizon'],
  ['Quel format d’apprentissage t’aide le plus ?', 'format'],
  ['Quelle contrainte importante dois-je respecter ?', 'constraints'],
  ['How do you currently learn this subject?', 'current_method'],
  ['What can you already do concretely in this area?', 'level'],
  ['What verifiable outcome do you want to achieve?', 'goal'],
  ['How much total time can you spend each week?', 'availability'],
  ['By when do you want to reach this goal?', 'horizon'],
  ['Which learning format helps you most?', 'format'],
  ['What important constraint should I respect?', 'constraints'],
]);

const QUESTION_TOPIC_PREFIXES = Object.freeze([
  ['current_method', ['Comment apprenez-vous actuellement «', 'Comment apprends-tu actuellement «', 'How do you currently learn “']],
  ['level', ['Que savez-vous déjà expliquer ou appliquer sur «', 'Que sais-tu déjà expliquer ou appliquer sur «', 'What can you already explain or apply about “', 'What can you already do concretely in “']],
  ['goal', ['Quel résultat concret souhaitez-vous atteindre en apprenant «', 'Quel résultat concret veux-tu atteindre en apprenant «', 'What concrete outcome do you want to achieve by learning “', 'What verifiable outcome do you want to achieve with “']],
  ['availability', ['Combien de temps pouvez-vous consacrer chaque semaine à «', 'Combien de temps peux-tu consacrer chaque semaine à «', 'How much time can you spend each week on “']],
  ['horizon', ['Quand souhaitez-vous atteindre votre objectif autour de «', 'Quand veux-tu atteindre ton objectif autour de «', 'By when do you want to reach your goal for “', 'By when do you want to reach your goal in “']],
  ['format', ['Quel format vous aiderait le plus à progresser sur «', 'Quel format t’aiderait le plus à progresser sur «', 'Which format would help you progress most with “', 'Which learning format would help you most with “']],
  ['constraints', ['Quelle contrainte dois-je respecter pour construire votre parcours sur «', 'Quelle contrainte dois-je respecter pour construire ton parcours sur «', 'What constraint should I respect when building your path for “', 'What important constraint should I respect for your learning path in “']],
]);

export function questionTopicFromMessage(message) {
  if (typeof message !== 'string') return null;
  if (message === OPENING_QUESTIONS.fr || message === OPENING_QUESTIONS.en) return 'subject';
  const legacy = LEGACY_QUESTION_TOPICS.get(message);
  if (legacy) return legacy;
  return QUESTION_TOPIC_PREFIXES.find(([, prefixes]) => prefixes.some((prefix) => message.startsWith(prefix)))?.[0] ?? null;
}

const ENGLISH_QUESTION_PREFIXES = Object.freeze([
  OPENING_QUESTIONS.en,
  'How do you currently learn',
  'What can you already explain or apply about',
  'What concrete outcome do you want to achieve',
  'Which format would help you progress most with',
  'What constraint should I respect when building',
  'What can you already do concretely in',
  'What verifiable outcome do you want to achieve',
  'How much ',
  'By when do you want to reach',
  'Which learning format',
  'What important constraint should I respect',
]);

export function canonicalInterviewQuestion(locale, topic, transcript) {
  const normalizedLocale = locale === 'en' ? 'en' : 'fr';
  if (topic === 'subject') return OPENING_QUESTIONS[normalizedLocale];
  const builders = normalizedLocale === 'en' ? ENGLISH_BUILDERS : FRENCH_BUILDERS;
  const builder = builders[topic];
  if (!builder) throw new Error('invalid_question_topic');
  return builder(subjectLabel(transcript));
}

export function transcriptLocale(transcript) {
  return transcript.some((message) => message?.role === 'assistant'
    && typeof message.content === 'string'
    && ENGLISH_QUESTION_PREFIXES.some((prefix) => message.content.startsWith(prefix)))
    ? 'en'
    : 'fr';
}
