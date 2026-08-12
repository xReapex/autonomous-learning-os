import { describe, expect, it } from 'vitest';

import { loadMobileDefaultData } from './mobile-default-data';
import { MobileDataValidationError, validateMobileContent } from './mobile-data-validation';

describe('validation serveur du contenu mobile', () => {
  it('accepte le contenu canonique généré', async () => {
    expect(validateMobileContent(await loadMobileDefaultData()).curriculum.course.id).toBe('clear-thinking');
  });

  it('rejette une ressource vidéo qui n’est pas YouTube vérifiable', async () => {
    const candidate = structuredClone(await loadMobileDefaultData());
    const video = candidate.curriculum.course.modules[0].lessons[0].videos.fr!;
    video.url = 'https://videos.example/not-youtube';

    expect(() => validateMobileContent(candidate)).toThrow(MobileDataValidationError);
  });

  it('rejette un contenu sans vidéo dans la langue générée', async () => {
    const candidate = structuredClone(await loadMobileDefaultData());
    candidate.curriculum.course = {
      ...candidate.curriculum.course,
      language: 'fr',
    } as typeof candidate.curriculum.course;
    delete candidate.curriculum.course.modules[0].lessons[0].videos.fr;

    expect(() => validateMobileContent(candidate)).toThrow(MobileDataValidationError);
  });
});
