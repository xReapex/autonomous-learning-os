// La reprise de lecture. C'est la fonction qui fait qu'on revient : on rouvre
// l'app et la vidéo reprend à la seconde exacte, sans chercher.

import type { LessonSource } from "./curriculum";
import { formatClock } from "./format";

export type LessonProgress = {
  lessonId: string;
  sourceUrl: string;
  positionSeconds: number;
  durationSeconds: number;
  completed: boolean;
  completedAt: string | null;
  lastWatchedAt: string | null;
};

function finiteSeconds(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

export function normalizeLessonProgress(value: unknown, lessonId: string, sourceUrl: string): LessonProgress {
  const progress = value && typeof value === "object" ? (value as Partial<LessonProgress>) : {};
  return {
    lessonId,
    sourceUrl,
    positionSeconds: finiteSeconds(progress.positionSeconds),
    durationSeconds: finiteSeconds(progress.durationSeconds),
    completed: progress.completed === true,
    completedAt: typeof progress.completedAt === "string" ? progress.completedAt : null,
    lastWatchedAt: typeof progress.lastWatchedAt === "string" ? progress.lastWatchedAt : null,
  };
}

/**
 * Le segment à lire maintenant, en tenant compte d'où on s'était arrêté.
 * La position sauvegardée gagne toujours sur le début configuré : sinon on
 * rejouerait chaque jour les mêmes minutes déjà vues.
 */
export function getResumableSegment(source: LessonSource, availableMinutes: number, savedPositionSeconds = 0) {
  const configuredStart = source.segmentStartSeconds ?? 0;
  const startSeconds = Math.max(configuredStart, finiteSeconds(savedPositionSeconds));
  const watchMinutes = Math.max(1, Math.min(source.minutes, availableMinutes));
  const requestedEnd = startSeconds + watchMinutes * 60;
  const fullDuration = source.totalMinutes ? source.totalMinutes * 60 : 0;
  const endSeconds = fullDuration ? Math.min(requestedEnd, fullDuration) : requestedEnd;

  return {
    startSeconds,
    endSeconds,
    watchMinutes: Math.max(1, Math.ceil((endSeconds - startSeconds) / 60)),
    startLabel: formatClock(startSeconds),
    endLabel: formatClock(endSeconds),
  };
}

/** Cinq secondes de marge : le lecteur ne rapporte jamais la fin exacte. */
export function isSegmentComplete(positionSeconds: number, endSeconds: number) {
  return endSeconds > 0 && positionSeconds >= endSeconds - 5;
}

/**
 * Décode un message de l'iframe YouTube.
 * Le contrôle d'origine est la seule barrière entre l'app et n'importe quelle
 * page qui posterait un message — il n'est pas décoratif.
 */
export function parseYouTubeProgressMessage(origin: string, data: unknown) {
  if (origin !== "https://www.youtube.com" && origin !== "https://www.youtube-nocookie.com") return null;

  let message: unknown = data;
  if (typeof data === "string") {
    try {
      message = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== "object") return null;

  const payload = message as { event?: unknown; info?: unknown };
  if (payload.event !== "infoDelivery" || !payload.info || typeof payload.info !== "object") return null;

  const info = payload.info as { currentTime?: unknown; duration?: unknown; playerState?: unknown };
  if (!Number.isFinite(Number(info.currentTime))) return null;

  return {
    currentTime: finiteSeconds(info.currentTime),
    duration: finiteSeconds(info.duration),
    playerState: Number.isInteger(Number(info.playerState)) ? Number(info.playerState) : null,
  };
}

export function trackedPlayerUrl(source: LessonSource, startSeconds: number, endSeconds: number) {
  if (!source.embedUrl) return "";
  const separator = source.embedUrl.includes("?") ? "&" : "?";
  return `${source.embedUrl}${separator}start=${startSeconds}&end=${endSeconds}&rel=0&enablejsapi=1&playsinline=1`;
}
