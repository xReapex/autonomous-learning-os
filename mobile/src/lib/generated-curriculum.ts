import type { Locale } from './i18n';
import type { LocalizedText, ScioData, YouTubeVideoResource } from '../types/scio';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 4_000) {
    throw new Error(`invalid_${field}`);
  }
  return value.trim();
}

function localized(value: string): LocalizedText {
  return { fr: value, en: value };
}

function youtubeId(urlValue: unknown, embedValue: unknown): string {
  const rawUrl = text(urlValue, 'youtube_url');
  const rawEmbed = text(embedValue, 'youtube_embed');
  let id = '';
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== 'https:' || url.username || url.password ||
        !['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be'].includes(host)) {
      throw new Error();
    }
    id = host === 'youtu.be'
      ? url.pathname.split('/').filter(Boolean)[0] ?? ''
      : url.pathname === '/watch'
        ? url.searchParams.get('v') ?? ''
        : /^\/(?:shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? '';
    const embed = new URL(rawEmbed);
    const embedId = /^\/embed\/([^/?#]+)/.exec(embed.pathname)?.[1] ?? '';
    if (embed.protocol !== 'https:' || embed.hostname !== 'www.youtube-nocookie.com' || embedId !== id) {
      throw new Error();
    }
  } catch {
    throw new Error('invalid_youtube_source');
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(id)) throw new Error('invalid_youtube_source');
  return id;
}

export function convertGeneratedCurriculum(value: unknown, locale: Locale): ScioData {
  if (!record(value) || value.version !== 1 || value.language !== locale || !Array.isArray(value.subjects) ||
      value.subjects.length === 0 || !Array.isArray(value.cards) || value.cards.length < 3) {
    throw new Error('invalid_document_language_or_shape');
  }

  const subjectTitle = text(value.subject, 'subject');
  const goal = text(value.goal, 'goal');
  const subjectIds = new Set<string>();
  const lessonOwners = new Map<string, string>();

  const modules = value.subjects.map((rawSubject) => {
    if (!record(rawSubject) || !Array.isArray(rawSubject.lessons) || rawSubject.lessons.length === 0) {
      throw new Error('invalid_subject');
    }
    const subjectId = text(rawSubject.id, 'subject_id');
    if (subjectIds.has(subjectId)) throw new Error('duplicate_subject');
    subjectIds.add(subjectId);
    const moduleTitle = text(rawSubject.title, 'subject_title');

    const lessons = rawSubject.lessons.map((rawLesson) => {
      if (!record(rawLesson) || !record(rawLesson.source) || !Array.isArray(rawLesson.keyTakeaways)) {
        throw new Error('invalid_lesson');
      }
      const lessonId = text(rawLesson.id, 'lesson_id');
      if (lessonOwners.has(lessonId)) throw new Error('duplicate_lesson');
      lessonOwners.set(lessonId, subjectId);
      const source = rawLesson.source;
      if (source.kind !== 'video' || source.language !== locale || source.access !== 'free') {
        throw new Error('invalid_source_language');
      }
      const id = youtubeId(source.url, source.embedUrl);
      const minutes = source.minutes;
      if (!Number.isInteger(minutes) || Number(minutes) < 1 || Number(minutes) > 240) {
        throw new Error('invalid_video_duration');
      }
      const video: YouTubeVideoResource = {
        kind: 'video',
        language: locale,
        title: text(source.title, 'source_title'),
        provider: text(source.provider, 'source_provider'),
        youtubeId: id,
        url: text(source.url, 'youtube_url'),
        embedUrl: text(source.embedUrl, 'youtube_embed'),
        durationMinutes: Number(minutes),
      };
      const takeaways = rawLesson.keyTakeaways.map((item) => text(item, 'takeaway')).join(' • ');
      const objective = text(rawLesson.objective, 'objective');
      return {
        id: lessonId,
        title: localized(text(rawLesson.title, 'lesson_title')),
        summary: localized(`${objective}${takeaways ? `\n${takeaways}` : ''}`),
        durationMinutes: Number(minutes),
        videos: { [locale]: video },
      };
    });

    return {
      id: subjectId,
      title: localized(moduleTitle),
      lessons,
    };
  });

  const cardIds = new Set<string>();
  const dueAt = `${text(value.generatedAt, 'generated_at')}T09:00:00.000Z`;
  if (Number.isNaN(Date.parse(dueAt))) throw new Error('invalid_generated_at');
  const cards = value.cards.map((rawCard) => {
    if (!record(rawCard)) throw new Error('invalid_card');
    const id = text(rawCard.id, 'card_id');
    const subjectId = text(rawCard.subjectId, 'card_subject');
    const lessonId = text(rawCard.lessonId, 'card_lesson');
    if (cardIds.has(id)) throw new Error('duplicate_card');
    cardIds.add(id);
    if (!subjectIds.has(subjectId) || lessonOwners.get(lessonId) !== subjectId) {
      throw new Error('invalid_card_reference');
    }
    return {
      id,
      front: localized(text(rawCard.front, 'card_front')),
      back: localized(text(rawCard.back, 'card_back')),
      dueAt,
    };
  });

  const exercises = cards.map((card, index) => {
    const distractors = [
      cards[(index + 1) % cards.length],
      cards[(index + 2) % cards.length],
    ];
    const exerciseId = `exercise:${card.id}`;
    return {
      id: exerciseId,
      question: card.front,
      options: [
        { id: `${exerciseId}:correct`, label: card.back },
        ...distractors.map((distractor, distractorIndex) => ({
          id: `${exerciseId}:distractor-${distractorIndex + 1}`,
          label: distractor.back,
        })),
      ],
      correctOptionId: `${exerciseId}:correct`,
      hint: localized(locale === 'fr'
        ? 'Retrouvez l’idée exacte expliquée dans la leçon.'
        : 'Recall the exact idea explained in the lesson.'),
    };
  });

  return {
    curriculum: {
      course: {
        id: `generated:${locale}:${subjectTitle}`,
        language: locale,
        title: localized(subjectTitle),
        description: localized(goal),
        modules,
      },
    },
    exercises,
    cards,
    progress: {
      completedLessonIds: [],
      passedExerciseIds: [],
      recalledCardIds: [],
      weeklyLessons: 0,
      weeklyReviews: 0,
    },
  };
}
