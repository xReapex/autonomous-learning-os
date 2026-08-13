import { describe, expect, it, vi } from 'vitest';

import { fetchConsistentDataSnapshot } from './consistent-data-snapshot';

const curriculum = { course: { id: 'alpha' } };
const cards = [{ id: 'card-one' }];
const progress = { completedLessonIds: [] };

describe('snapshot pédagogique cohérent', () => {
  it('recommence si la génération change pendant les lectures composites', async () => {
    const getCurriculum = vi.fn()
      .mockResolvedValueOnce({ curriculum, revision: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' })
      .mockResolvedValueOnce({ curriculum: null, revision: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' })
      .mockResolvedValueOnce({ curriculum, revision: '"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"' })
      .mockResolvedValueOnce({ curriculum, revision: '"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"' });
    const getCards = vi.fn().mockResolvedValue(cards);
    const getProgress = vi.fn().mockResolvedValue(progress);

    await expect(fetchConsistentDataSnapshot({ getCurriculum, getCards, getProgress }))
      .resolves.toEqual({
        status: 'ready',
        data: {
          curriculumRevision: '"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"',
          curriculum,
          cards,
          exercises: [],
          progress,
        },
      });
    expect(getCurriculum).toHaveBeenCalledTimes(4);
    expect(getCards).toHaveBeenCalledTimes(2);
    expect(getProgress).toHaveBeenCalledTimes(2);
  });

  it('recommence si un état vide est activé pendant sa confirmation', async () => {
    const getCurriculum = vi.fn()
      .mockResolvedValueOnce({ curriculum: null, revision: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' })
      .mockResolvedValueOnce({ curriculum, revision: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' })
      .mockResolvedValueOnce({ curriculum, revision: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' });

    await expect(fetchConsistentDataSnapshot({
      getCurriculum,
      getCards: async () => cards,
      getProgress: async () => progress,
    })).resolves.toMatchObject({
      status: 'ready',
      data: {
        curriculumRevision: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"',
        curriculum,
      },
    });
    expect(getCurriculum).toHaveBeenCalledTimes(3);
  });

  it('confirme deux fois la même génération vide avant de la publier', async () => {
    const empty = { curriculum: null, revision: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' };
    const getCurriculum = vi.fn().mockResolvedValue(empty);

    await expect(fetchConsistentDataSnapshot({
      getCurriculum,
      getCards: async () => cards,
      getProgress: async () => progress,
    })).resolves.toEqual({
      status: 'empty',
      revision: empty.revision,
    });
    expect(getCurriculum).toHaveBeenCalledTimes(2);
  });

  it('échoue sans publier après deux lectures traversées par une mutation', async () => {
    const getCurriculum = vi.fn()
      .mockResolvedValueOnce({ curriculum, revision: '"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' })
      .mockResolvedValueOnce({ curriculum, revision: '"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"' })
      .mockResolvedValueOnce({ curriculum, revision: '"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"' })
      .mockResolvedValueOnce({ curriculum, revision: '"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"' });

    await expect(fetchConsistentDataSnapshot({
      getCurriculum,
      getCards: async () => cards,
      getProgress: async () => progress,
    })).rejects.toThrow('curriculum_snapshot_changed');
  });
});
