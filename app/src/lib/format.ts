import type { LessonSource } from "@/lib/curriculum";

export function formatClock(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return [hours, minutes, seconds]
      .map((part, index) => (index === 0 ? String(part) : String(part).padStart(2, "0")))
      .join(":");
  }

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} h ${remainder}` : `${hours} h`;
}

export function formatDate(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(date);
}

export function formatDateTime(value: string | null | undefined, fallback = "—") {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/**
 * Le segment à regarder aujourd'hui : jamais plus long que le temps disponible
 * dans le bloc « capsule », jamais plus long que ce que la source prévoit.
 */
export function getSourceSegment(source: LessonSource, availableMinutes: number) {
  const startSeconds = source.segmentStartSeconds ?? 0;
  const watchMinutes = Math.max(1, Math.min(source.minutes, availableMinutes));
  const endSeconds = startSeconds + watchMinutes * 60;

  return {
    startSeconds,
    endSeconds,
    watchMinutes,
    startLabel: formatClock(startSeconds),
    endLabel: formatClock(endSeconds),
  };
}
