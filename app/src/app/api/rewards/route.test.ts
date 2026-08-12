import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { createFileStorage } from "@/lib/storage/file-storage";
import { createRewardsHandlers } from "./route";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("GET /api/rewards", () => {
  it("renvoie uniquement la synthèse sans écriture ni attribution passive", async () => {
    const directory = await mkdtemp(join(tmpdir(), "scio-rewards-route-"));
    directories.push(directory);
    const storage = createFileStorage(directory);
    const { GET } = createRewardsHandlers(() => storage);

    const first = await GET();
    const second = await GET();

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({ totalXp: 0, masteryPoints: 0, tier: { id: "seed" } });
    await expect(second.json()).resolves.toMatchObject({ totalXp: 0, streak: { current: 0 } });
    await expect(readFile(join(directory, "rewards.json"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });
});
