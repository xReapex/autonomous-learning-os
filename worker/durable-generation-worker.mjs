import { request as httpRequest } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { validateVideoSources } from "./source-contract.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const outputSchema = JSON.parse(await readFile(join(here, "interview-output.schema.json"), "utf8"));

const MAX_BODY = 64 * 1024;
const exact = (value, keys) => Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const plain = (value) => typeof value === "object" && value !== null && !Array.isArray(value);

function validSchemaValue(value, rule, root = rule) {
  if (!plain(rule)) return true;
  if (typeof rule.$ref === "string") {
    const target = rule.$ref.replace(/^#\//, "").split("/").reduce((node, key) => plain(node) ? node[key] : undefined, root);
    return validSchemaValue(value, target, root);
  }
  if (Array.isArray(rule.anyOf) && !rule.anyOf.some((candidate) => validSchemaValue(value, candidate, root))) return false;
  if (Object.hasOwn(rule, "const") && value !== rule.const) return false;
  if (Array.isArray(rule.enum) && !rule.enum.includes(value)) return false;
  if (typeof rule.type === "string") {
    const matches = rule.type === "null" ? value === null
      : rule.type === "array" ? Array.isArray(value)
      : rule.type === "object" ? plain(value)
      : rule.type === "integer" ? Number.isInteger(value)
      : rule.type === "number" ? typeof value === "number" && Number.isFinite(value)
      : typeof value === rule.type;
    if (!matches) return false;
  }
  if (typeof value === "string") {
    if (Number.isInteger(rule.minLength) && value.length < rule.minLength) return false;
    if (Number.isInteger(rule.maxLength) && value.length > rule.maxLength) return false;
    if (typeof rule.pattern === "string" && !new RegExp(rule.pattern).test(value)) return false;
  }
  if (typeof value === "number") {
    if (typeof rule.minimum === "number" && value < rule.minimum) return false;
    if (typeof rule.maximum === "number" && value > rule.maximum) return false;
  }
  if (Array.isArray(value)) {
    if (Number.isInteger(rule.minItems) && value.length < rule.minItems) return false;
    if (Number.isInteger(rule.maxItems) && value.length > rule.maxItems) return false;
    if (rule.items && !value.every((item) => validSchemaValue(item, rule.items, root))) return false;
  }
  if (plain(value)) {
    if (Array.isArray(rule.required) && rule.required.some((key) => !Object.hasOwn(value, key))) return false;
    if (rule.additionalProperties === false && plain(rule.properties) && Object.keys(value).some((key) => !Object.hasOwn(rule.properties, key))) return false;
    if (plain(rule.properties) && Object.entries(rule.properties).some(([key, child]) => Object.hasOwn(value, key) && !validSchemaValue(value[key], child, root))) return false;
  }
  return true;
}

function validCurriculumRelations(document) {
  if (validateVideoSources(document).length > 0) return false;
  const subjectIds = new Set();
  const lessonIds = new Set();
  const lessonOwners = new Map();
  for (const subject of document.subjects ?? []) {
    if (subjectIds.has(subject.id)) return false;
    subjectIds.add(subject.id);
    for (const lesson of subject.lessons ?? []) {
      if (lessonIds.has(lesson.id)) return false;
      lessonIds.add(lesson.id);
      lessonOwners.set(lesson.id, subject.id);
    }
  }
  const cardIds = new Set();
  for (const card of document.cards ?? []) {
    if (cardIds.has(card.id)) return false;
    cardIds.add(card.id);
    if (!subjectIds.has(card.subjectId) || !lessonIds.has(card.lessonId) || lessonOwners.get(card.lessonId) !== card.subjectId) return false;
  }
  return subjectIds.size > 0 && lessonIds.size > 0 && cardIds.size >= 3;
}

export function validPublicInterviewResponse(value, validateDocument = (document) => validSchemaValue({ phase: "proposal", questionTopic: null, message: "ok", choices: [], progress: 100, document }, outputSchema) && validCurriculumRelations(document)) {
  return plain(value)
    && exact(value, ["phase", "message", "choices", "progress", "document", "state"])
    && value.phase === "proposal"
    && typeof value.message === "string"
    && value.message.trim().length > 0
    && value.message.length <= 2_000
    && Array.isArray(value.choices)
    && value.choices.length === 0
    && value.progress === 100
    && typeof value.state === "string"
    && value.state.length >= 40
    && value.state.length <= 56_000
    && plain(value.document)
    && validateDocument(value.document);
}

function unixWorkerClient(body, signal, secret) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new Error("aborted"));
    const payload = Buffer.from(JSON.stringify(body));
    const request = httpRequest({
      socketPath: process.env.CODEX_INTERVIEW_WORKER_SOCKET ?? "/run/learningos-codex/worker.sock",
      path: "/interview",
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "content-type": "application/json",
        accept: "application/json",
        "content-length": payload.length,
      },
    }, (response) => {
      const chunks = [];
      let total = 0;
      response.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_BODY) {
          response.destroy();
          request.destroy();
        } else chunks.push(chunk);
      });
      response.once("end", () => resolve(new Response(Buffer.concat(chunks), {
        status: response.statusCode ?? 502,
        headers: { "content-type": String(response.headers["content-type"] ?? "") },
      })));
      response.once("aborted", () => reject(new Error("worker_transport")));
      response.once("error", () => reject(new Error("worker_transport")));
    });
    const abort = () => request.destroy(new Error("aborted"));
    signal.addEventListener("abort", abort, { once: true });
    request.once("error", (error) => reject(new Error(error.message === "aborted" ? "aborted" : "worker_transport")));
    request.once("close", () => signal.removeEventListener("abort", abort));
    request.end(payload);
  });
}

export function createInterviewJobExecutor({
  workerClient = unixWorkerClient,
  secret = process.env.CODEX_INTERVIEW_WORKER_SECRET,
  validateOutput = validPublicInterviewResponse,
} = {}) {
  return async function execute(payload, signal) {
    if (!plain(payload) || !exact(payload, ["state", "action"]) || payload.action !== "confirm" || typeof payload.state !== "string" || payload.state.length < 40 || payload.state.length > 56_000) {
      throw new Error("invalid_payload");
    }
    if (typeof secret !== "string" || secret.length < 32) throw new Error("worker_configuration");
    const response = await workerClient(payload, signal, secret);
    if (!response.ok) throw new Error("worker_status");
    if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new Error("worker_media");
    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_BODY) throw new Error("worker_body");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (signal.aborted) throw new Error("aborted");
    if (bytes.byteLength > MAX_BODY) throw new Error("worker_body");
    let output;
    try { output = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
    catch { throw new Error("invalid_output"); }
    if (!validateOutput(output)) throw new Error("invalid_output");
    return output;
  };
}
