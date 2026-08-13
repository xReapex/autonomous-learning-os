type CurriculumSnapshot<C> = {
  curriculum: C | null;
  revision: string;
};

type CardPayload<E, R> = R[] | { cards: R[]; exercises?: E[] };

type Dependencies<C extends { exercises?: E[] }, E, R, P> = {
  getCurriculum: () => Promise<CurriculumSnapshot<C>>;
  getCards: () => Promise<CardPayload<E, R>>;
  getProgress: () => Promise<P>;
};

type ConsistentDataSnapshot<C extends { exercises?: E[] }, E, R, P> =
  | { status: 'empty'; revision: string }
  | {
      status: 'ready';
      data: {
        curriculumRevision: string;
        curriculum: C;
        cards: R[];
        exercises: E[];
        progress: P;
      };
    };

export async function fetchConsistentDataSnapshot<C extends { exercises?: E[] }, E, R, P>({
  getCurriculum,
  getCards,
  getProgress,
}: Dependencies<C, E, R, P>): Promise<ConsistentDataSnapshot<C, E, R, P>> {
  let carriedSnapshot: CurriculumSnapshot<C> | null = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const before = carriedSnapshot ?? await getCurriculum();
    carriedSnapshot = null;
    if (!before.curriculum) {
      const after = await getCurriculum();
      if (!after.curriculum && after.revision === before.revision) {
        return { status: 'empty', revision: before.revision };
      }
      carriedSnapshot = after;
      continue;
    }
    const [cardPayload, progress] = await Promise.all([getCards(), getProgress()]);
    const after = await getCurriculum();
    if (after.curriculum && after.revision === before.revision) {
      return {
        status: 'ready',
        data: {
          curriculumRevision: before.revision,
          curriculum: before.curriculum,
          cards: Array.isArray(cardPayload) ? cardPayload : cardPayload.cards,
          exercises:
            (!Array.isArray(cardPayload) ? cardPayload.exercises : undefined) ??
            before.curriculum.exercises ??
            [],
          progress,
        },
      };
    }
  }
  throw new Error('curriculum_snapshot_changed');
}
