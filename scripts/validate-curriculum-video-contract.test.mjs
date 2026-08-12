import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const validator = join(root, "scripts", "validate-curriculum.mjs");
const delivered = join(root, "app", "content", "curriculum.json");

test("le curriculum vidéo livré est valide", () => {
  const result = spawnSync(process.execPath, [validator, delivered], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
});

test("le validateur CLI refuse toute ressource non vidéo", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scio-contract-"));
  try {
    const document = JSON.parse(await readFile(delivered, "utf8"));
    const source = document.subjects[0].lessons[0].source;
    source.kind = "reading";
    delete source.embedUrl;
    delete source.totalMinutes;
    const candidate = join(directory, "curriculum.json");
    await writeFile(candidate, JSON.stringify(document));

    const result = spawnSync(process.execPath, [validator, candidate], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /seule une vid[eé]o/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("le validateur CLI refuse une vidéo dans une langue différente", async () => {
  const directory = await mkdtemp(join(tmpdir(), "scio-contract-"));
  try {
    const document = JSON.parse(await readFile(delivered, "utf8"));
    document.subjects[0].lessons[0].source.language = "en";
    const candidate = join(directory, "curriculum.json");
    await writeFile(candidate, JSON.stringify(document));

    const result = spawnSync(process.execPath, [validator, candidate], { cwd: root, encoding: "utf8" });

    assert.notEqual(result.status, 0);
    assert.match(`${result.stdout}\n${result.stderr}`, /doit correspondre/i);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
