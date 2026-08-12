import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { InterprocessLockError, withInterprocessFileLock } from './interprocess-file-lock';

describe('verrou fichier interprocessus', () => {
  it('récupère un verrou abandonné par un processus mort', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-lock-dead-'));
    const lockPath = join(directory, 'locks', 'store.lock');
    await mkdir(dirname(lockPath), { recursive: true });
    await writeFile(lockPath, JSON.stringify({ token: 'abandoned', pid: 2_147_483_647 }), 'utf8');

    await expect(withInterprocessFileLock(lockPath, async () => 'recovered', { timeoutMs: 100 }))
      .resolves.toBe('recovered');
  });

  it('ne vole jamais le verrou d’un processus encore vivant', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'scio-lock-live-'));
    const lockPath = join(directory, 'store.lock');
    await writeFile(lockPath, JSON.stringify({ token: 'live', pid: process.pid }), 'utf8');

    await expect(withInterprocessFileLock(lockPath, async () => 'forbidden', { timeoutMs: 30 }))
      .rejects.toBeInstanceOf(InterprocessLockError);
  });
});
