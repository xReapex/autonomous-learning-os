import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { createFileStorage } from "@/lib/storage/file-storage";
import { createCardsHandlers } from "./route";

const directories: string[] = [];
const card = defaultCurriculumDocument.cards[0];
const active = { document: defaultCurriculumDocument, revision: "test", source: "delivered" as const, warnings: [] };

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "scio-cards-route-"));
  directories.push(directory);
  const storage = createFileStorage(directory);
  return {
    directory,
    storage,
    handlers: createCardsHandlers({
      storage: () => storage,
      loadCurriculum: async () => active,
      now: () => new Date("2026-08-10T10:00:00.000Z"),
    }),
  };
}

function post(grade: number, eventId: string) {
  return new Request("https://scio.test/api/cards", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ cardId: card.id, grade, eventId }),
  });
}

describe("récompense de POST /api/cards", () => {
  it("GET et les notes 0/1 ne récompensent jamais", async () => {
    const { directory, handlers } = await setup();
    await handlers.GET();
    const response = await handlers.POST(post(1, "review-hard"));
    await expect(response.json()).resolves.toMatchObject({ reward: null });
    await expect(readFile(join(directory, "rewards.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("récompense grade >= 2 et déduplique un retry par eventId", async () => {
    const { handlers, storage } = await setup();
    const first = await handlers.POST(post(2, "review-success-1"));
    const retry = await handlers.POST(post(2, "review-success-1"));

    await expect(first.json()).resolves.toMatchObject({ reward: { awarded: true, reward: { xp: 25 } } });
    await expect(retry.json()).resolves.toMatchObject({ reward: { awarded: false, reward: { xp: 0 } } });
    await expect(storage.getRewardState()).resolves.toMatchObject({ totalXp: 25 });
  });
});
