type ReadDependencies<T> = {
  readData: () => Promise<string | null>;
  parse: (value: unknown) => T;
};

type ClearDependencies = {
  writeEmpty: () => Promise<void>;
  removeLegacyData: () => Promise<void>;
  publishEmpty: () => void;
};

type CacheEnvelope<T> =
  | { version: 1; status: 'empty'; revision?: string }
  | { version: 1; status: 'ready'; data: T };

export type AuthoritativeCacheState<T> =
  | { status: 'missing' }
  | { status: 'empty'; revision: string | null }
  | { status: 'ready'; data: T };

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function validRevision(value: unknown): value is string {
  return typeof value === 'string' && /^"[a-f0-9]{64}"$/.test(value);
}

export async function readAuthoritativeCacheState<T>({
  readData,
  parse,
}: ReadDependencies<T>): Promise<AuthoritativeCacheState<T>> {
  const stored = await readData().catch(() => null);
  if (!stored) return { status: 'missing' };
  try {
    const value: unknown = JSON.parse(stored);
    if (isRecord(value) && value.version === 1 && value.status === 'empty') {
      return { status: 'empty', revision: validRevision(value.revision) ? value.revision : null };
    }
    if (isRecord(value) && value.version === 1 && value.status === 'ready') {
      return { status: 'ready', data: parse(value.data) };
    }
    return { status: 'ready', data: parse(value) };
  } catch {
    return { status: 'missing' };
  }
}

export async function readAuthoritativeCache<T>(dependencies: ReadDependencies<T>): Promise<T | null> {
  const state = await readAuthoritativeCacheState(dependencies);
  return state.status === 'ready' ? state.data : null;
}

export async function clearAuthoritativeCache({
  writeEmpty,
  removeLegacyData,
  publishEmpty,
}: ClearDependencies): Promise<{ emptyWritten: boolean; legacyDataRemoved: boolean }> {
  const emptyWritten = await writeEmpty().then(() => true, () => false);
  const legacyDataRemoved = emptyWritten
    ? false
    : await removeLegacyData().then(() => true, () => false);
  publishEmpty();
  return { emptyWritten, legacyDataRemoved };
}

export function serializeEmptyCache(revision: string): string {
  if (!validRevision(revision)) throw new Error('curriculum_revision_invalid');
  const envelope: CacheEnvelope<never> = { version: 1, status: 'empty', revision };
  return JSON.stringify(envelope);
}

export function serializeActiveCache<T>(data: T): string {
  const envelope: CacheEnvelope<T> = { version: 1, status: 'ready', data };
  return JSON.stringify(envelope);
}
