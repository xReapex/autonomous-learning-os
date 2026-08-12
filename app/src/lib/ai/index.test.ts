import { afterEach, describe, expect, it } from "vitest";

import { automaticAiAllowedForCurriculum, currentProvider, runPrompt } from "./index";

const originalHostedSafeMode = process.env.HOSTED_SAFE_MODE;
const originalProvider = process.env.AI_PROVIDER;
const originalRuntimeOptIn = process.env.ALLOW_RUNTIME_CURRICULUM_AI;

afterEach(() => {
  if (originalHostedSafeMode === undefined) delete process.env.HOSTED_SAFE_MODE;
  else process.env.HOSTED_SAFE_MODE = originalHostedSafeMode;

  if (originalProvider === undefined) delete process.env.AI_PROVIDER;
  else process.env.AI_PROVIDER = originalProvider;

  if (originalRuntimeOptIn === undefined) delete process.env.ALLOW_RUNTIME_CURRICULUM_AI;
  else process.env.ALLOW_RUNTIME_CURRICULUM_AI = originalRuntimeOptIn;
});

describe("hosted safe mode", () => {
  it("forces manual correction even when CLI mode is requested", async () => {
    process.env.HOSTED_SAFE_MODE = "true";
    process.env.AI_PROVIDER = "cli";

    expect(currentProvider()).toBe("claude-code");
    await expect(runPrompt("un exercice sans donnée secrète")).resolves.toMatchObject({
      status: "manual",
      provider: "claude-code",
    });
  });

  it("interdit l'IA automatique sur une surcharge sans opt-in explicite", () => {
    delete process.env.ALLOW_RUNTIME_CURRICULUM_AI;

    expect(automaticAiAllowedForCurriculum("override", "cli")).toBe(false);
    expect(automaticAiAllowedForCurriculum("override", "api")).toBe(false);
    expect(automaticAiAllowedForCurriculum("override", "claude-code")).toBe(true);
    expect(automaticAiAllowedForCurriculum("delivered", "cli")).toBe(true);

    process.env.ALLOW_RUNTIME_CURRICULUM_AI = "true";
    expect(automaticAiAllowedForCurriculum("override", "cli")).toBe(true);
  });
});
