type CurriculumRemovalDependencies = {
  removeRemote: () => Promise<string>;
  removeCache: (revision: string) => Promise<void>;
};

export async function removeCurriculumDurably({
  removeRemote,
  removeCache,
}: CurriculumRemovalDependencies): Promise<string> {
  const emptyRevision = await removeRemote();
  await removeCache(emptyRevision);
  return emptyRevision;
}
