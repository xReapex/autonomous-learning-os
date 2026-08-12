import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { createFileStorage } from "@/lib/storage/file-storage";
import { createCoachHandlers, POST } from "./route";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("/api/coach", () => {
  it.each([
    ["null", "null"],
    ["un tableau", "[]"],
    ["une chaîne", '"texte"'],
    ["un nombre", "42"],
  ])("refuse %s avec une réponse contrôlée", async (_label, body) => {
    const response = await POST(new Request("https://learning.test/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }));

    expect(response.status).toBe(400);
  });

  it("refuse un corps UTF-8 invalide", async () => {
    const response = await POST(new Request("https://learning.test/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new Uint8Array([0xc3, 0x28]),
    }));

    expect(response.status).toBe(400);
  });

  it("interrompt un corps supérieur à la limite même sans Content-Length", async () => {
    const request = new Request("https://learning.test/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: `{"lessonId":"learning-method-active-recall","answer":"${"x".repeat(40_000)}"}`,
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining("volumineux") });
  });

  it("récompense une correction produite une fois par eventId avec le vrai stockage fichier", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scio-coach-route-"));
    directories.push(directory);
    const storage = createFileStorage(directory);
    const lesson = defaultCurriculumDocument.subjects[0].lessons[0];
    const handlers = createCoachHandlers({
      storage: () => storage,
      loadCurriculum: async () => ({ document: defaultCurriculumDocument, revision: "test", source: "delivered", warnings: [] }),
      correct: async () => ({ status: "completed", text: "Correction utile.", provider: "api" }),
      now: () => new Date("2026-08-10T10:00:00.000Z"),
    });
    const request = () => new Request("https://scio.test/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "exercise-success-1",
        lessonId: lesson.id,
        answer: Array.from({ length: 24 }, (_, index) => `mot${index}`).join(" "),
      }),
    });

    const first = await handlers.POST(request());
    const retry = await handlers.POST(request());

    await expect(first.json()).resolves.toMatchObject({ status: "completed", reward: { awarded: true, reward: { xp: 60 } } });
    await expect(retry.json()).resolves.toMatchObject({ status: "completed", reward: { awarded: false, reward: { xp: 0 } } });
    await expect(storage.getRewardState()).resolves.toMatchObject({ totalXp: 60 });
    await expect(storage.listAnswers()).resolves.toHaveLength(1);
  });

  it("ne récompense pas le mode manuel ou un échec de correction", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scio-coach-route-"));
    directories.push(directory);
    const storage = createFileStorage(directory);
    const lesson = defaultCurriculumDocument.subjects[0].lessons[0];
    const handlers = createCoachHandlers({
      storage: () => storage,
      loadCurriculum: async () => ({ document: defaultCurriculumDocument, revision: "test", source: "delivered", warnings: [] }),
      correct: async (prompt) => ({ status: "manual", prompt, provider: "claude-code" }),
    });
    const response = await handlers.POST(new Request("https://scio.test/api/coach", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventId: "exercise-manual-1",
        lessonId: lesson.id,
        answer: Array.from({ length: 24 }, (_, index) => `mot${index}`).join(" "),
      }),
    }));

    await expect(response.json()).resolves.toMatchObject({ status: "manual", reward: null });
    await expect(storage.getRewardState()).resolves.toMatchObject({ totalXp: 0 });
  });
});
