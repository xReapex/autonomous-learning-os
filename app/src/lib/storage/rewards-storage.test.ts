import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import type { RewardEvent } from "../rewards";
import { createFileStorage } from "./file-storage";

const directories: string[] = [];

async function temporaryStorage() {
  const directory = await mkdtemp(join(tmpdir(), "scio-rewards-"));
  directories.push(directory);
  return { directory, storage: createFileStorage(directory) };
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const rewardEvent: RewardEvent = {
  eventId: "lesson:lesson-1:completed",
  kind: "lesson_completed",
  occurredAt: "2026-08-10T09:00:00.000Z",
  subjectId: "subject-1",
  itemId: "lesson-1",
};

describe("récompenses du stockage fichier", () => {
  it("reste idempotent par eventId, y compris en concurrence", async () => {
    const { storage } = await temporaryStorage();
    const grants = await Promise.all([
      storage.awardReward(rewardEvent),
      storage.awardReward(rewardEvent),
      storage.awardReward(rewardEvent),
    ]);

    expect(grants.filter((grant) => grant.awarded)).toHaveLength(1);
    await expect(storage.getRewardState()).resolves.toMatchObject({ totalXp: 100, masteryPoints: 20 });
  });

  it("un GET d'état vide ne matérialise aucun fichier et n'accorde rien", async () => {
    const { directory, storage } = await temporaryStorage();
    await expect(storage.getRewardState()).resolves.toEqual(expect.objectContaining({ totalXp: 0, masteryPoints: 0 }));
    await expect(readFile(join(directory, "rewards.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("persiste les eventId et recharge le même état depuis un vrai fichier temporaire", async () => {
    const { directory, storage } = await temporaryStorage();
    await storage.awardReward(rewardEvent);
    const reloaded = createFileStorage(directory);

    await expect(reloaded.awardReward(rewardEvent)).resolves.toMatchObject({ awarded: false, reward: { xp: 0, mastery: 0 } });
    await expect(reloaded.getRewardState()).resolves.toMatchObject({ totalXp: 100, masteryPoints: 20 });
    expect(JSON.parse(await readFile(join(directory, "rewards.json"), "utf8")).eventIds).toEqual([rewardEvent.eventId]);
  });
});
