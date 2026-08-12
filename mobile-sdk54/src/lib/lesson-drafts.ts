export type LessonDrafts = Record<string, string>;

export function updateLessonDraft(
  drafts: LessonDrafts,
  lessonId: string,
  body: string,
): LessonDrafts {
  return { ...drafts, [lessonId]: body };
}

export function clearLessonDraft(drafts: LessonDrafts, lessonId: string): LessonDrafts {
  const next = { ...drafts };
  delete next[lessonId];
  return next;
}
