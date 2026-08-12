import type { Locale } from './i18n';
import type { Curriculum, Lesson, YouTubeVideoResource } from '../types/scio';

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);

function videoIdFromUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || !youtubeHosts.has(url.hostname.toLowerCase())) return null;
    if (url.hostname.toLowerCase() === 'youtu.be') return url.pathname.split('/').filter(Boolean)[0] ?? null;
    if (url.pathname === '/watch') return url.searchParams.get('v');
    return /^\/(?:shorts|live)\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function videoIdFromEmbed(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== 'https:' || url.hostname.toLowerCase() !== 'www.youtube-nocookie.com') {
      return null;
    }
    return /^\/embed\/([^/?#]+)/.exec(url.pathname)?.[1] ?? null;
  } catch {
    return null;
  }
}

function validVideo(video: unknown, locale: Locale): video is YouTubeVideoResource {
  if (!video || typeof video !== 'object') return false;
  const candidate = video as Partial<YouTubeVideoResource>;
  if (
    candidate.kind !== 'video' ||
    candidate.language !== locale ||
    typeof candidate.youtubeId !== 'string' ||
    !/^[A-Za-z0-9_-]{11}$/.test(candidate.youtubeId) ||
    typeof candidate.url !== 'string' ||
    typeof candidate.embedUrl !== 'string'
  ) {
    return false;
  }
  return (
    videoIdFromUrl(candidate.url) === candidate.youtubeId &&
    videoIdFromEmbed(candidate.embedUrl) === candidate.youtubeId
  );
}

export function getVideoForLocale(
  lesson: Lesson,
  locale: Locale,
): YouTubeVideoResource | null {
  const videos = lesson.videos as Partial<Record<Locale, YouTubeVideoResource>> | undefined;
  const video = videos?.[locale];
  return validVideo(video, locale) ? video : null;
}

export function validateCurriculumVideos(
  curriculum: Curriculum,
  locales: readonly Locale[],
): string[] {
  const errors: string[] = [];
  for (const module of curriculum.course.modules) {
    for (const lesson of module.lessons) {
      for (const locale of locales) {
        if (!getVideoForLocale(lesson, locale)) {
          errors.push(`${module.id}.${lesson.id}.${locale}: valid YouTube video required`);
        }
      }
    }
  }
  return errors;
}
