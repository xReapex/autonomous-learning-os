import test from 'node:test';
import assert from 'node:assert/strict';

import {
  QUESTION_TOPIC_NAMES,
  canonicalInterviewQuestion,
  questionTopicFromMessage,
  transcriptLocale,
} from './interview-questions.mjs';

const subject = 'la cryptographie post-quantique';
const frenchTranscript = [
  { role: 'assistant', content: 'Quel sujet précis souhaitez-vous apprendre ?' },
  { role: 'user', content: subject },
];
const englishTranscript = [
  { role: 'assistant', content: 'What exactly do you want to learn?' },
  { role: 'user', content: 'post-quantum cryptography' },
];

test('personnalise chaque question postérieure au sujet en français', () => {
  for (const topic of QUESTION_TOPIC_NAMES.filter((value) => value !== 'subject')) {
    const question = canonicalInterviewQuestion('fr', topic, frenchTranscript);
    assert.match(question, /la cryptographie post-quantique/);
    assert.doesNotMatch(question, /ce sujet|ce domaine|cet objectif/i);
    assert.match(question, /\?$/);
  }
});

test('emploie des formulations naturelles autour du sujet canonique', () => {
  assert.equal(
    canonicalInterviewQuestion('fr', 'level', frenchTranscript),
    'Que savez-vous déjà expliquer ou appliquer sur « la cryptographie post-quantique » ?',
  );
  assert.equal(
    canonicalInterviewQuestion('fr', 'goal', frenchTranscript),
    'Quel résultat concret souhaitez-vous atteindre en apprenant « la cryptographie post-quantique » ?',
  );
  assert.equal(
    canonicalInterviewQuestion('en', 'level', englishTranscript),
    'What can you already explain or apply about “post-quantum cryptography”?',
  );
  assert.equal(
    canonicalInterviewQuestion('en', 'goal', englishTranscript),
    'What concrete outcome do you want to achieve by learning “post-quantum cryptography”?',
  );
});

test('personalizes every post-subject question in English', () => {
  for (const topic of QUESTION_TOPIC_NAMES.filter((value) => value !== 'subject')) {
    const question = canonicalInterviewQuestion('en', topic, englishTranscript);
    assert.match(question, /post-quantum cryptography/);
    assert.doesNotMatch(question, /this subject|this area|this goal/i);
    assert.match(question, /\?$/);
  }
});

test('conserve la question d’ouverture avant de connaître le sujet', () => {
  assert.equal(canonicalInterviewQuestion('fr', 'subject', []), 'Quel sujet précis souhaitez-vous apprendre ?');
  assert.equal(canonicalInterviewQuestion('en', 'subject', []), 'What exactly do you want to learn?');
});

test('retrouve le thème des questions signées nouvelles et historiques', () => {
  for (const topic of QUESTION_TOPIC_NAMES) {
    assert.equal(questionTopicFromMessage(canonicalInterviewQuestion('fr', topic, frenchTranscript)), topic);
    assert.equal(questionTopicFromMessage(canonicalInterviewQuestion('en', topic, englishTranscript)), topic);
  }
  assert.equal(questionTopicFromMessage('Comment apprends-tu actuellement ce sujet ?'), 'current_method');
  assert.equal(questionTopicFromMessage('How much total time can you spend each week?'), 'availability');
  assert.equal(questionTopicFromMessage('Question arbitraire ?'), null);
});

test('neutralise les guillemets internes avant de citer le sujet', () => {
  const question = canonicalInterviewQuestion('fr', 'current_method', [
    frenchTranscript[0],
    { role: 'user', content: 'Comparer « Dune » et “Foundation”' },
  ]);
  assert.equal(question, 'Comment apprenez-vous actuellement « Comparer Dune et Foundation » ?');
});

test('normalise et borne le sujet affiché sans perdre sa personnalisation', () => {
  const longSubject = `  cryptographie\u0000 ${'quantique '.repeat(40)} `;
  const question = canonicalInterviewQuestion('fr', 'goal', [
    frenchTranscript[0],
    { role: 'user', content: longSubject },
  ]);
  assert.ok(question.length < 260);
  assert.doesNotMatch(question, /\u0000/);
  assert.match(question, /cryptographie quantique/);
  assert.match(question, /…/);
});

test('déduit la locale depuis la question d’ouverture signée', () => {
  assert.equal(transcriptLocale(frenchTranscript), 'fr');
  assert.equal(transcriptLocale(englishTranscript), 'en');
});

test('préserve la locale des états anglais créés avant la personnalisation', () => {
  assert.equal(transcriptLocale([{ role: 'assistant', content: 'How do you currently learn this subject?' }]), 'en');
  assert.equal(transcriptLocale([{ role: 'assistant', content: 'What verifiable outcome do you want to achieve?' }]), 'en');
  assert.equal(transcriptLocale([{ role: 'assistant', content: 'How much total time can you spend each week?' }]), 'en');
});

test('reconnaît une question anglaise personnalisée même sans question d’ouverture', () => {
  assert.equal(transcriptLocale([{ role: 'assistant', content: 'Which learning format would help you most with “TypeScript”?' }]), 'en');
  assert.equal(transcriptLocale([{ role: 'assistant', content: 'Quel format d’apprentissage t’aiderait le plus pour « TypeScript » ?' }]), 'fr');
});
