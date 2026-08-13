type CurriculumRemovalDependencies = {
  removeRemote: () => Promise<void>;
  removeCache: () => Promise<void>;
};

export async function removeCurriculumDurably({
  removeRemote,
  removeCache,
}: CurriculumRemovalDependencies): Promise<void> {
  await removeRemote();
  await removeCache();
}
