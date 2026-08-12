import { describe, expect, it } from "vitest";

import { defaultCurriculumDocument } from "@/lib/curriculum";
import { curriculumRevision } from "@/lib/curriculum-store";
import { createSerializedCurriculumMutationQueue, makeCurriculumClientState } from "./curriculum-context";

describe("état client du curriculum", () => {
  it("sérialise les mutations et continue après un échec", async () => {
    const enqueue = createSerializedCurriculumMutationQueue();
    const started: string[] = [];
    let releaseFirst!: () => void;
    const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve; });

    const first = enqueue(async () => { started.push("first"); await firstGate; return 1; });
    const second = enqueue(async () => { started.push("second"); return 2; });
    await Promise.resolve();
    expect(started).toEqual(["first"]);
    releaseFirst();
    await expect(first).resolves.toBe(1);
    await expect(second).resolves.toBe(2);
    await expect(enqueue(async () => { throw new Error("expected"); })).rejects.toThrow("expected");
    await expect(enqueue(async () => 3)).resolves.toBe(3);
  });

  it("normalise une réponse serveur tout en conservant le document exportable", () => {
    const document = structuredClone(defaultCurriculumDocument);
    delete document.subjects[0].lessons[0].source.segmentStartSeconds;

    const state = makeCurriculumClientState({
      document,
      revision: curriculumRevision(document),
      source: "override",
      warnings: [],
    });

    expect(state.document.version).toBe(1);
    expect(state.curriculum.subjects[0].lesson.source.segmentStartSeconds).toBe(0);
    expect(state.source).toBe("override");
  });
});
