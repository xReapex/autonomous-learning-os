import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { createFileStorage } from "@/lib/storage/file-storage";
import { createProgressHandlers } from "./route";

const directories: string[] = [];
const lesson = defaultCurriculumDocument.subjects[0].lessons[0];
const active = {
  document: defaultCurriculumDocument,
  revision: "test-revision",
  source: "delivered" as const,
  warnings: [],
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "scio-progress-route-"));
  directories.push(directory);
  const storage = createFileStorage(directory);
  return {
    directory,
    storage,
    handlers: createProgressHandlers({
      storage: () => storage,
      loadCurriculum: async () => active,
      now: () => new Date("2026-08-10T10:00:00.000Z"),
    }),
  };
}

function put(completed: boolean) {
  return new Request(`https://scio.test/api/progress/${lesson.id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ positionSeconds: completed ? 660 : 120, durationSeconds: 660, completed }),
  });
}

describe("récompense de PUT /api/progress/[lessonId]", () => {
  it("ne récompense ni GET ni une sauvegarde de lecture incomplète", async () => {
    const { directory, handlers } = await setup();
    await handlers.GET(new Request("https://scio.test"), { params: Promise.resolve({ lessonId: lesson.id }) });
    const response = await handlers.PUT(put(false), { params: Promise.resolve({ lessonId: lesson.id }) });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ completed: false, reward: null });
    await expect(readFile(join(directory, "rewards.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("récompense une seule fois la première transition vers terminé", async () => {
    const { handlers, storage } = await setup();
    const first = await handlers.PUT(put(true), { params: Promise.resolve({ lessonId: lesson.id }) });
    const retry = await handlers.PUT(put(true), { params: Promise.resolve({ lessonId: lesson.id }) });

    await expect(first.json()).resolves.toMatchObject({ reward: { awarded: true, reward: { xp: 100 } } });
    await expect(retry.json()).resolves.toMatchObject({ reward: { awarded: false, reward: { xp: 0 } } });
    await expect(storage.getRewardState()).resolves.toMatchObject({ totalXp: 100 });
  });
});
