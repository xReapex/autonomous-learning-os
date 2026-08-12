import { randomUUID } from 'node:crypto';
import { mkdir, open, readFile, stat, unlink } from 'node:fs/promises';
import { dirname } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

export class InterprocessLockError extends Error {
  constructor() {
    super('interprocess_lock_timeout');
    this.name = 'InterprocessLockError';
  }
}

type LockOwner = { token: string; pid: number };

function parseOwner(raw: string): LockOwner | null {
  try {
    const owner = JSON.parse(raw) as { token?: unknown; pid?: unknown };
    if (typeof owner.token !== 'string' || !owner.token || !Number.isSafeInteger(owner.pid) || Number(owner.pid) <= 0) {
      return null;
    }
    return { token: owner.token, pid: Number(owner.pid) };
  } catch {
    return null;
  }
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

async function acquireRecoveryClaim(path: string): Promise<Awaited<ReturnType<typeof open>> | null> {
  try {
    const claim = await open(path, 'wx', 0o600);
    await claim.writeFile(JSON.stringify({ token: randomUUID(), pid: process.pid }), 'utf8');
    await claim.sync();
    return claim;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return null;
    throw error;
  }
}

async function recoverAbandonedLock(lockPath: string, staleMalformedAfterMs: number): Promise<boolean> {
  const recoveryPath = `${lockPath}.recovery`;
  const claim = await acquireRecoveryClaim(recoveryPath);
  if (!claim) return false;

  try {
    let observed: string;
    try {
      observed = await readFile(lockPath, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }

    const owner = parseOwner(observed);
    if (owner) {
      if (processIsAlive(owner.pid)) return false;
    } else if (Date.now() - (await stat(lockPath)).mtimeMs < staleMalformedAfterMs) {
      return false;
    }

    // Le claim sérialise la récupération. La seconde lecture empêche de
    // supprimer un verrou remplacé entre l’observation et l’unlink.
    if (await readFile(lockPath, 'utf8').catch(() => '') !== observed) return false;
    await unlink(lockPath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
    return true;
  } finally {
    await claim.close().catch(() => undefined);
    await unlink(recoveryPath).catch(() => undefined);
  }
}

export async function withInterprocessFileLock<T>(
  lockPath: string,
  operation: () => Promise<T>,
  {
    timeoutMs = 5_000,
    staleMalformedAfterMs = 30_000,
  }: { timeoutMs?: number; staleMalformedAfterMs?: number } = {},
): Promise<T> {
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
  const deadline = Date.now() + timeoutMs;
  const token = randomUUID();
  let lock: Awaited<ReturnType<typeof open>>;

  while (true) {
    try {
      lock = await open(lockPath, 'wx', 0o600);
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      if (await recoverAbandonedLock(lockPath, staleMalformedAfterMs)) continue;
      if (Date.now() >= deadline) throw new InterprocessLockError();
      await delay(10);
    }
  }

  try {
    await lock.writeFile(JSON.stringify({ token, pid: process.pid }), 'utf8');
    await lock.sync();
  } catch (error) {
    await lock.close().catch(() => undefined);
    await unlink(lockPath).catch(() => undefined);
    throw error;
  }

  try {
    return await operation();
  } finally {
    await lock.close().catch(() => undefined);
    try {
      const owner = parseOwner(await readFile(lockPath, 'utf8'));
      if (owner?.token === token) await unlink(lockPath);
    } catch {
      // Un verrou absent ou remplacé n’appartient plus à cette opération.
    }
  }
}
