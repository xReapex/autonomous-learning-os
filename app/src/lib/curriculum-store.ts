import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { defaultCurriculumDocument, type CurriculumDocument } from "./curriculum";
import { validateCurriculumDocument } from "./curriculum-validation";

export const MAX_CURRICULUM_BYTES = 1024 * 1024;
const LOCK_TIMEOUT_MS = 5_000;

export type ActiveCurriculum = {
  document: CurriculumDocument;
  revision: string;
  source: "delivered" | "override";
  warnings: string[];
  error?: string;
};

type CurriculumStoreOptions = {
  dataDir: string;
  deliveredDocument: CurriculumDocument;
  lockTimeoutMs?: number;
};

export class CurriculumValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super("Le curriculum ne respecte pas le contrat.");
    this.name = "CurriculumValidationError";
    this.issues = issues;
  }
}

export class CurriculumRevisionError extends Error {
  readonly currentRevision: string;

  constructor(currentRevision: string) {
    super("Le curriculum a été modifié dans un autre onglet.");
    this.name = "CurriculumRevisionError";
    this.currentRevision = currentRevision;
  }
}

export class CurriculumLockError extends Error {
  constructor() {
    super("Le curriculum est verrouillé par une autre écriture.");
    this.name = "CurriculumLockError";
  }
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function curriculumRevision(document: CurriculumDocument): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(document))).digest("hex");
}

function deliveredActive(document: CurriculumDocument, error?: string): ActiveCurriculum {
  return {
    document,
    revision: curriculumRevision(document),
    source: "delivered",
    warnings: [],
    ...(error ? { error } : {}),
  };
}

export function createCurriculumStore(options: CurriculumStoreOptions) {
  const target = join(options.dataDir, "curriculum.json");
  const lockPath = join(options.dataDir, ".curriculum.lock");
  let writeQueue: Promise<void> = Promise.resolve();

  function serializeWrite<T>(operation: () => Promise<T>): Promise<T> {
    const result = writeQueue.then(operation, operation);
    writeQueue = result.then(() => undefined, () => undefined);
    return result;
  }

  async function withInterprocessLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
    await chmod(options.dataDir, 0o700);
    const deadline = Date.now() + (options.lockTimeoutMs ?? LOCK_TIMEOUT_MS);
    const token = randomUUID();
    let lock: Awaited<ReturnType<typeof open>>;

    while (true) {
      try {
        lock = await open(lockPath, "wx", 0o600);
        break;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        if (Date.now() >= deadline) throw new CurriculumLockError();
        await delay(10);
      }
    }

    try {
      await lock.writeFile(JSON.stringify({ token, pid: process.pid }), "utf8");
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
        const owner = JSON.parse(await readFile(lockPath, "utf8")) as { token?: unknown };
        if (owner.token === token) await unlink(lockPath);
      } catch {
        // Un verrou absent ou remplacé n'appartient plus à cette opération.
      }
    }
  }

  async function load(): Promise<ActiveCurriculum> {
    let size: number;
    try {
      size = (await stat(target)).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return deliveredActive(options.deliveredDocument);
      }
      return deliveredActive(options.deliveredDocument, "Impossible de lire la surcharge du curriculum.");
    }

    if (size > MAX_CURRICULUM_BYTES) {
      return deliveredActive(options.deliveredDocument, "La surcharge du curriculum dépasse la taille autorisée.");
    }

    try {
      const parsed = JSON.parse(await readFile(target, "utf8")) as unknown;
      const validation = validateCurriculumDocument(parsed);
      if (!validation.ok) {
        return deliveredActive(options.deliveredDocument, "La surcharge du curriculum est invalide.");
      }
      const document = parsed as CurriculumDocument;
      return {
        document,
        revision: curriculumRevision(document),
        source: "override",
        warnings: validation.warnings,
      };
    } catch {
      return deliveredActive(options.deliveredDocument, "La surcharge du curriculum est illisible.");
    }
  }

  function replace(candidate: unknown, expectedRevision: string): Promise<ActiveCurriculum> {
    return serializeWrite(() => withInterprocessLock(async () => {
      const current = await load();
      if (current.revision !== expectedRevision) {
        throw new CurriculumRevisionError(current.revision);
      }

      const validation = validateCurriculumDocument(candidate);
      if (!validation.ok) throw new CurriculumValidationError(validation.errors);

      const document = candidate as CurriculumDocument;
      const serialized = `${JSON.stringify(document, null, 2)}\n`;
      if (Buffer.byteLength(serialized, "utf8") > MAX_CURRICULUM_BYTES) {
        throw new CurriculumValidationError(["curriculum: taille maximale dépassée"]);
      }

      await mkdir(options.dataDir, { recursive: true, mode: 0o700 });
      await chmod(options.dataDir, 0o700);
      const temporary = join(options.dataDir, `.curriculum-${process.pid}-${randomUUID()}.tmp`);
      const handle = await open(temporary, "wx", 0o600);
      try {
        await handle.writeFile(serialized, "utf8");
        await handle.sync();
      } catch (error) {
        await handle.close().catch(() => undefined);
        await unlink(temporary).catch(() => undefined);
        throw error;
      }
      await handle.close();

      try {
        await rename(temporary, target);
      } catch (error) {
        await unlink(temporary).catch(() => undefined);
        throw error;
      }

      return {
        document,
        revision: curriculumRevision(document),
        source: "override",
        warnings: validation.warnings,
      };
    }));
  }

  function reset(expectedRevision: string): Promise<ActiveCurriculum> {
    return serializeWrite(() => withInterprocessLock(async () => {
      const current = await load();
      if (current.revision !== expectedRevision) {
        throw new CurriculumRevisionError(current.revision);
      }
      try {
        await unlink(target);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      return deliveredActive(options.deliveredDocument);
    }));
  }

  return { load, replace, reset };
}

export const curriculumStore = createCurriculumStore({
  dataDir: process.env.LEARNING_DATA_DIR ?? join(process.cwd(), ".data"),
  deliveredDocument: defaultCurriculumDocument,
});

export function loadActiveCurriculum(): Promise<ActiveCurriculum> {
  return curriculumStore.load();
}
