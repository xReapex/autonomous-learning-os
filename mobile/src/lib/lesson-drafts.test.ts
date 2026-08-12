import { describe, expect, it } from 'vitest';

import { clearLessonDraft, updateLessonDraft } from './lesson-drafts';

describe('lesson note drafts', () => {
  it('keeps drafts isolated by lesson id', () => {
    let drafts = updateLessonDraft({}, 'lesson-a', 'note A');
    drafts = updateLessonDraft(drafts, 'lesson-b', 'note B');

    expect(drafts).toEqual({ 'lesson-a': 'note A', 'lesson-b': 'note B' });
  });

  it('clears only the saved lesson draft', () => {
    const drafts = clearLessonDraft({ 'lesson-a': 'note A', 'lesson-b': 'note B' }, 'lesson-b');

    expect(drafts).toEqual({ 'lesson-a': 'note A' });
  });
});
