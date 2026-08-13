import { describe, expect, it, vi } from 'vitest';

import {
  clearAuthoritativeCache,
  readAuthoritativeCache,
  serializeActiveCache,
  serializeEmptyCache,
} from './authoritative-data-cache';

describe('cache pédagogique autoritaire', () => {
  it('publie toujours l’état vide après un 204 même si toute écriture locale échoue', async () => {
    const publishEmpty = vi.fn();

    await expect(clearAuthoritativeCache({
      writeEmpty: async () => { throw new Error('storage unavailable'); },
      removeLegacyData: async () => { throw new Error('storage unavailable'); },
      publishEmpty,
    })).resolves.toEqual({ emptyWritten: false, legacyDataRemoved: false });

    expect(publishEmpty).toHaveBeenCalledOnce();
  });

  it('écrit un état vide autoritaire sans supprimer ensuite cette sentinelle', async () => {
    const removeLegacyData = vi.fn();

    await expect(clearAuthoritativeCache({
      writeEmpty: async () => undefined,
      removeLegacyData,
      publishEmpty: vi.fn(),
    })).resolves.toEqual({ emptyWritten: true, legacyDataRemoved: false });

    expect(removeLegacyData).not.toHaveBeenCalled();
  });

  it('ignore les données d’une enveloppe autoritairement vide', async () => {
    await expect(readAuthoritativeCache({
      readData: async () => JSON.stringify({ version: 1, status: 'empty' }),
      parse: (value: unknown) => value,
    })).resolves.toBeNull();
  });

  it('conserve la génération opaque dans l’enveloppe vide autoritaire', () => {
    const revision = `"${'e'.repeat(64)}"`;
    expect(JSON.parse(serializeEmptyCache(revision))).toEqual({
      version: 1,
      status: 'empty',
      revision,
    });
  });

  it('lit encore un ancien cache brut puis encode le nouveau cache actif dans une seule enveloppe', async () => {
    const legacy = { curriculum: { course: { id: 'legacy' } } };
    await expect(readAuthoritativeCache({
      readData: async () => JSON.stringify(legacy),
      parse: (value: unknown) => value,
    })).resolves.toEqual(legacy);

    const data = { ...legacy, curriculumRevision: `"${'c'.repeat(64)}"` };
    const active = JSON.parse(serializeActiveCache(data));
    expect(active).toEqual({ version: 1, status: 'ready', data });
    await expect(readAuthoritativeCache({
      readData: async () => JSON.stringify(active),
      parse: (value: unknown) => value,
    })).resolves.toEqual(data);
  });
});
