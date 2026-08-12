import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "./curriculum";
import { createCurriculumStore } from "./curriculum-store";

const directories: string[] = [];

async function temporaryDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "learning-os-curriculum-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("CurriculumStore", () => {
  it("sert le curriculum livré quand aucune surcharge n'existe", async () => {
    const dataDir = await temporaryDirectory();
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });

    const active = await store.load();

    expect(active.source).toBe("delivered");
    expect(active.document).toEqual(defaultCurriculumDocument);
    expect(active.revision).toMatch(/^[a-f0-9]{64}$/);
    await expect(readFile(join(dataDir, "curriculum.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retombe sur le curriculum livré et signale une surcharge persistée invalide", async () => {
    const dataDir = await temporaryDirectory();
    await writeFile(join(dataDir, "curriculum.json"), '{"version":2}\n', { mode: 0o600 });
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });

    const active = await store.load();

    expect(active.source).toBe("delivered");
    expect(active.document).toEqual(defaultCurriculumDocument);
    expect(active.error).toContain("invalide");
    await expect(readFile(join(dataDir, "curriculum.json"), "utf8")).resolves.toContain('"version":2');
  });

  it("persiste puis recharge une surcharge valide en mode privé", async () => {
    const dataDir = await temporaryDirectory();
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const before = await store.load();
    const candidate = structuredClone(defaultCurriculumDocument);
    candidate.subject = "Mon cursus runtime";

    const saved = await store.replace(candidate, before.revision);
    const reloaded = await createCurriculumStore({
      dataDir,
      deliveredDocument: defaultCurriculumDocument,
    }).load();

    expect(saved.source).toBe("override");
    expect(reloaded.document.subject).toBe("Mon cursus runtime");
    expect(JSON.parse(await readFile(join(dataDir, "curriculum.json"), "utf8"))).toEqual(candidate);
    expect((await stat(join(dataDir, "curriculum.json"))).mode & 0o777).toBe(0o600);
  });

  it("refuse un remplacement invalide sans écraser la surcharge active", async () => {
    const dataDir = await temporaryDirectory();
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const first = structuredClone(defaultCurriculumDocument);
    first.subject = "Version valide";
    const saved = await store.replace(first, (await store.load()).revision);
    const invalid = structuredClone(first);
    invalid.subjects[0].lessons[0].source.url = "file:///etc/passwd";

    await expect(store.replace(invalid, saved.revision)).rejects.toMatchObject({
      name: "CurriculumValidationError",
    });
    expect((await store.load()).document.subject).toBe("Version valide");
  });

  it("refuse la seconde sauvegarde concurrente basée sur une révision périmée", async () => {
    const dataDir = await temporaryDirectory();
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const revision = (await store.load()).revision;
    const first = structuredClone(defaultCurriculumDocument);
    first.subject = "Premier onglet";
    const second = structuredClone(defaultCurriculumDocument);
    second.subject = "Second onglet";

    const results = await Promise.allSettled([
      store.replace(first, revision),
      store.replace(second, revision),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ name: "CurriculumRevisionError" });
  });

  it("sérialise aussi deux instances de store partageant le même répertoire", async () => {
    const dataDir = await temporaryDirectory();
    const firstStore = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const secondStore = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const revision = (await firstStore.load()).revision;
    const first = structuredClone(defaultCurriculumDocument);
    first.subject = "Premier processus";
    const second = structuredClone(defaultCurriculumDocument);
    second.subject = "Second processus";

    const results = await Promise.allSettled([
      firstStore.replace(first, revision),
      secondStore.replace(second, revision),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ name: "CurriculumRevisionError" });
  });

  it("ne vole jamais un verrou laissé par un autre propriétaire", async () => {
    const dataDir = await temporaryDirectory();
    const lockPath = join(dataDir, ".curriculum.lock");
    await writeFile(lockPath, JSON.stringify({ token: "autre-proprietaire", pid: 999999 }), { mode: 0o600 });
    const store = createCurriculumStore({
      dataDir,
      deliveredDocument: defaultCurriculumDocument,
      lockTimeoutMs: 40,
    });

    await expect(
      store.replace(defaultCurriculumDocument, (await store.load()).revision),
    ).rejects.toMatchObject({ name: "CurriculumLockError" });
    await expect(readFile(lockPath, "utf8")).resolves.toContain("autre-proprietaire");
  });

  it("réinitialise vers le curriculum livré sans le modifier", async () => {
    const dataDir = await temporaryDirectory();
    const store = createCurriculumStore({ dataDir, deliveredDocument: defaultCurriculumDocument });
    const candidate = structuredClone(defaultCurriculumDocument);
    candidate.subject = "Surcharge temporaire";
    const saved = await store.replace(candidate, (await store.load()).revision);

    const reset = await store.reset(saved.revision);

    expect(reset.source).toBe("delivered");
    expect(reset.document.subject).toBe(defaultCurriculumDocument.subject);
    await expect(readFile(join(dataDir, "curriculum.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
