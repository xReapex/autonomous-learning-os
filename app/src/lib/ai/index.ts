// Trois façons de brancher l'IA, une seule interface.
//
//   claude-code  L'app ne parle à aucun modèle. Elle rend le prompt, l'utilisateur
//                le donne à son agent déjà ouvert. Aucune clé, aucun coût, et ça
//                marche même hors ligne. C'est le mode par défaut, volontairement.
//
//   cli          L'app appelle une CLI locale (claude, codex) en sous-processus.
//                L'authentification est celle de la CLI : rien n'est stocké ici.
//
//   api          L'app appelle Anthropic ou OpenAI avec LA CLÉ DE L'UTILISATEUR,
//                lue dans son .env.local. Ce dépôt ne fournit aucune clé.

import { spawn } from "node:child_process";

export type AiProvider = "claude-code" | "cli" | "api";

export type AiOutcome =
  | { status: "completed"; text: string; provider: AiProvider }
  /** Le prompt est prêt mais c'est à l'humain (ou à son agent) de le traiter. */
  | { status: "manual"; prompt: string; provider: AiProvider }
  | { status: "failed"; error: string; provider: AiProvider };

export function currentProvider(): AiProvider {
  // Public deployments run behind a shared HTTP surface. In this mode, never
  // let environment drift enable a local CLI or a billable API call.
  if (process.env.HOSTED_SAFE_MODE === "true") return "claude-code";
  const value = (process.env.AI_PROVIDER || "claude-code").toLowerCase();
  return value === "cli" || value === "api" ? value : "claude-code";
}

export function automaticAiAllowedForCurriculum(
  source: "delivered" | "override",
  provider: AiProvider,
): boolean {
  return provider === "claude-code" || source === "delivered" || process.env.ALLOW_RUNTIME_CURRICULUM_AI === "true";
}

export function providerLabel(provider: AiProvider): string {
  return {
    "claude-code": "Ton agent",
    cli: `CLI locale (${process.env.AI_CLI_BIN || "claude"})`,
    api: `API ${process.env.AI_API_VENDOR || "anthropic"}`,
  }[provider];
}

export async function runPrompt(prompt: string): Promise<AiOutcome> {
  const provider = currentProvider();
  try {
    if (provider === "cli") return await runViaCli(prompt);
    if (provider === "api") return await runViaApi(prompt);
    return { status: "manual", prompt, provider };
  } catch (error) {
    return { status: "failed", error: (error as Error).message, provider };
  }
}

// ── Mode CLI ─────────────────────────────────────────────────────────────────

const CLI_TIMEOUT_MS = 120_000;

function runViaCli(prompt: string): Promise<AiOutcome> {
  const bin = process.env.AI_CLI_BIN || "claude";
  // Chaque CLI a sa propre forme de mode non interactif ; on ne fait pas
  // d'heuristique sur des binaires inconnus.
  const args = bin === "codex" ? ["exec", "--"] : ["-p"];

  return new Promise((resolve) => {
    const child = spawn(/* turbopackIgnore: true */ bin, args, {
      stdio: ["pipe", "pipe", "pipe"],
      // Le prompt part par stdin, pas en argument : il contient la réponse de
      // l'apprenant, et les arguments de processus sont visibles par `ps`.
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (outcome: AiOutcome) => {
      if (settled) return;
      settled = true;
      resolve(outcome);
    };

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish({ status: "failed", error: `La CLI ${bin} n'a pas répondu en 2 minutes.`, provider: "cli" });
    }, CLI_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => { stdout += String(chunk); });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });

    child.on("error", (error) => {
      clearTimeout(timer);
      finish({
        status: "failed",
        error: `Impossible de lancer « ${bin} » : ${error.message}. Vérifie AI_CLI_BIN.`,
        provider: "cli",
      });
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0 && stdout.trim()) {
        finish({ status: "completed", text: stdout.trim(), provider: "cli" });
      } else {
        finish({
          status: "failed",
          error: stderr.trim() || `La CLI ${bin} est sortie en code ${code} sans produire de texte.`,
          provider: "cli",
        });
      }
    });

    child.stdin.write(prompt);
    child.stdin.end();
  });
}

// ── Mode API ─────────────────────────────────────────────────────────────────

// Appels HTTP directs plutôt que SDK : deux dépendances de moins à installer et
// à maintenir pour deux requêtes POST.
async function runViaApi(prompt: string): Promise<AiOutcome> {
  const vendor = (process.env.AI_API_VENDOR || "anthropic").toLowerCase();

  if (vendor === "openai") {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error("AI_API_VENDOR=openai mais OPENAI_API_KEY est vide dans .env.local.");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "gpt-4.1",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1200,
      }),
    });

    if (!response.ok) throw new Error(`OpenAI a répondu ${response.status}. Vérifie ta clé et ton quota.`);
    const body = await response.json();
    const text = body?.choices?.[0]?.message?.content;
    if (!text) throw new Error("OpenAI n'a renvoyé aucun texte.");
    return { status: "completed", text, provider: "api" };
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("AI_API_VENDOR=anthropic mais ANTHROPIC_API_KEY est vide dans .env.local.");

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL || "claude-sonnet-4-5-20250929",
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error(`Anthropic a répondu ${response.status}. Vérifie ta clé et ton quota.`);
  const body = await response.json();
  const text = body?.content?.[0]?.text;
  if (!text) throw new Error("Anthropic n'a renvoyé aucun texte.");
  return { status: "completed", text, provider: "api" };
}
