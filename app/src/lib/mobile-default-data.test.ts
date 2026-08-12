import { describe, expect, it } from 'vitest';

import { loadMobileDefaultData } from './mobile-default-data';

describe('donnée mobile canonique serveur', () => {
  it('charge le curriculum, les exercices et les cartes générés depuis le client canonique', async () => {
    const data = await loadMobileDefaultData();
    const lessons = data.curriculum.course.modules.flatMap((module) => module.lessons);

    expect(lessons).toHaveLength(4);
    expect(data.exercises).toHaveLength(1);
    expect(data.cards).toHaveLength(2);
    expect(lessons.every((lesson) => lesson.videos.fr?.youtubeId && lesson.videos.en?.youtubeId)).toBe(true);
  });
});
