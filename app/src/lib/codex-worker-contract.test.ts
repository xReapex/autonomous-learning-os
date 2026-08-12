import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "..");

describe("worker Codex isolé", () => {
  it("appelle le modèle Codex sans fournir aucun outil local", async () => {
    const source = await readFile(join(root, "worker/server.mjs"), "utf8");
    expect(source).toContain('const MODEL = "gpt-5.6-sol"');
    expect(source).toContain('tool_choice: "none"');
    expect(source).toContain("parallel_tool_calls: false");
    expect(source).not.toContain("child_process");
    expect(source).not.toContain("spawn(");
    expect(source).not.toContain("codex exec");
    expect(source).toContain('process.env.CODEX_INTERVIEW_WORKER_SOCKET ?? "/run/learningos-codex/worker.sock"');
  });

  it("contraint la sortie, signe l’état et automatise la vérification des sources", async () => {
    const [source, schema, policy] = await Promise.all([
      readFile(join(root, "worker/server.mjs"), "utf8"),
      readFile(join(root, "worker/interview-output.schema.json"), "utf8"),
      readFile(join(root, "worker/POLICY.md"), "utf8"),
    ]);
    expect(JSON.parse(schema).additionalProperties).toBe(false);
    expect(source).toContain("createHmac");
    expect(source).toContain("learning-os-interview-v2");
    expect(source).toContain("awaiting_confirmation");
    expect(source).toContain("generationAuthorized");
    expect(source).toContain('res.once("close"');
    expect(source).toContain("verifyHttpsUrl");
    expect(source).toContain("isPrivateAddress");
    expect(source).toContain("TRUSTED_URL_VALIDATION_ERRORS");
    expect(source).toContain("TRUSTED_RESPONSE_SCHEMA_ERROR");
    expect(source).toContain('if (attempt === 0) continue;\n      throw new Error("provider_schema")');
    expect(source).toContain("MAX_CALLS_PER_HOUR");
    expect(policy).toMatch(/une seule question/i);
    expect(policy).toMatch(/six réponses/i);
  });

  it("durcit le service, masque les données et bloque le réseau privé", async () => {
    const unit = await readFile(join(root, "deploy/learningos-codex.service"), "utf8");
    expect(unit).toContain("ProtectSystem=strict");
    expect(unit).toContain("ProtectHome=true");
    expect(unit).toContain("InaccessiblePaths=/var/lib/autonomous-learning-os");
    expect(unit).toContain("IPAddressDeny=");
    expect(unit).toContain("RuntimeDirectory=learningos-codex");
    expect(unit).toContain("RuntimeDirectoryMode=0750");
    expect(unit).toContain("64:ff9b::/96");
    expect(unit).toContain("64:ff9b:1::/48");
    expect(unit).toContain("2001::/32");
    expect(unit).toContain("fec0::/10");
    expect(unit).toContain("KillMode=control-group");
  });
});
