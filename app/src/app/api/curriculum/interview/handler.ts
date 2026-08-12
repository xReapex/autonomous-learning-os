import { timingSafeEqual } from "node:crypto";
import { request as httpRequest } from "node:http";
import { MAX_INTERVIEW_BODY_BYTES, validateInterviewRequest, validateInterviewResponse, type InterviewRequest } from "@/lib/curriculum-interview";
import { bearerToken, scioAuthStoreFromEnvironment } from "@/lib/scio-auth";
import type { ScioSessionIdentity } from "@/lib/scio-auth-store";

type WorkerClient = (body: InterviewRequest, signal: AbortSignal, secret: string) => Promise<Response>;
type RetryDelay = (signal: AbortSignal) => Promise<void>;
type HeartbeatDelay = (signal: AbortSignal) => Promise<void>;
class TooLarge extends Error {}
export class WorkerTransportError extends Error {
  constructor() { super("worker_transport"); this.name = "WorkerTransportError"; }
}
const MAX_WORKER_ATTEMPTS = 3;

function safeEqual(received: string | null, expected: string | undefined): boolean {
  if (!received || !expected || expected.length < 32) return false;
  const a = Buffer.from(received), b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site && site !== "same-origin" && site !== "none") return false;
  try {
    const origin = request.headers.get("origin");
    return !!origin && !!process.env.APP_URL && new URL(origin).origin === new URL(process.env.APP_URL).origin;
  } catch { return false; }
}

type SessionVerifier = {
  verifySession: (token: string) => Promise<ScioSessionIdentity | null>;
};

export async function mobileBearerAuthorized(
  request: Request,
  auth: SessionVerifier = scioAuthStoreFromEnvironment(),
): Promise<boolean> {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "cross-site") return false;
  const token = bearerToken(request);
  if (!token) return false;
  return !!(await auth.verifySession(token));
}

function error(status: number, code: string, message: string): Response {
  return Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
}

async function boundedJson(input: { body: ReadableStream<Uint8Array> | null; headers: Headers }, cap: number): Promise<unknown> {
  const declared = Number(input.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > cap) throw new TooLarge();
  if (!input.body) throw new SyntaxError();
  const reader = input.body.getReader(), chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) { await reader.cancel(); throw new TooLarge(); }
    chunks.push(value);
  }
  const all = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(all));
}

const callWorker: WorkerClient = (body, signal, secret) => new Promise((resolve, reject) => {
  if (signal.aborted) { reject(new DOMException("Aborted", "AbortError")); return; }
  const payload = Buffer.from(JSON.stringify(body));
  let settled = false;
  const settle = (error?: Error, response?: Response) => {
    if (settled) return;
    settled = true;
    signal.removeEventListener("abort", abort);
    if (error) reject(error); else resolve(response!);
  };
  const socketPath = process.env.CODEX_INTERVIEW_WORKER_SOCKET ?? "/run/learningos-codex/worker.sock";
  const request = httpRequest({ socketPath, path: "/interview", method: "POST", headers: { authorization: "Bearer " + secret, "content-type": "application/json", accept: "application/json", "content-length": payload.length } }, (response) => {
    const chunks: Buffer[] = []; let total = 0;
    response.on("data", (chunk: Buffer) => {
      total += chunk.length;
      if (total > MAX_INTERVIEW_BODY_BYTES) {
        settle(new TooLarge());
        response.destroy();
        request.destroy();
      } else chunks.push(chunk);
    });
    response.once("end", () => settle(undefined, new Response(Buffer.concat(chunks), { status: response.statusCode ?? 502, headers: { "content-type": String(response.headers["content-type"] ?? "") } })));
    response.once("aborted", () => settle(new WorkerTransportError()));
    response.once("error", () => settle(new WorkerTransportError()));
    response.once("close", () => { if (!response.complete) settle(new WorkerTransportError()); });
  });
  const abort = () => {
    settle(new DOMException("Aborted", "AbortError"));
    request.destroy();
  };
  signal.addEventListener("abort", abort, { once: true });
  request.once("error", (error) => settle(error instanceof TooLarge ? error : new WorkerTransportError()));
  request.end(payload);
});

const waitForWorkerRetry: RetryDelay = (signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
  const timer = setTimeout(done, 1_100);
  const abort = () => done(new DOMException("Aborted", "AbortError"));
  function done(error?: Error) {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    if (error) reject(error); else resolve();
  }
  signal.addEventListener("abort", abort, { once: true });
});

const waitForHeartbeat: HeartbeatDelay = (signal) => new Promise((resolve, reject) => {
  if (signal.aborted) return reject(new DOMException("Aborted", "AbortError"));
  const timer = setTimeout(done, 15_000);
  const abort = () => done(new DOMException("Aborted", "AbortError"));
  function done(cause?: Error) {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
    if (cause) reject(cause); else resolve();
  }
  signal.addEventListener("abort", abort, { once: true });
});

async function responseWithHeartbeat(operation: Promise<Response>, workerAborter: AbortController, delay: HeartbeatDelay): Promise<Response> {
  const delayAborter = new AbortController();
  const winner = await Promise.race([
    operation.then((response) => ({ kind: "response" as const, response })),
    delay(delayAborter.signal).then(() => ({ kind: "heartbeat" as const })),
  ]);
  if (winner.kind === "response") {
    delayAborter.abort();
    return winner.response;
  }
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  let closed = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const close = () => { if (!closed) { closed = true; if (timer) clearInterval(timer); controller.close(); } };
      controller.enqueue(encoder.encode("\n"));
      timer = setInterval(() => { if (!closed) controller.enqueue(encoder.encode("\n")); }, 10_000);
      void operation.then(async (response) => {
        if (closed) return;
        try {
          const payload = new Uint8Array(await response.arrayBuffer());
          if (closed) return;
          controller.enqueue(payload);
          close();
        } catch {
          if (!closed) controller.enqueue(encoder.encode(JSON.stringify({ error: { code: "interview_unavailable", message: "L’entretien Codex est indisponible." } })));
          close();
        }
      }, () => {
        if (!closed) controller.enqueue(encoder.encode(JSON.stringify({ error: { code: "interview_unavailable", message: "L’entretien Codex est indisponible." } })));
        close();
      });
    },
    cancel() { closed = true; if (timer) clearInterval(timer); workerAborter.abort(); },
  });
  return new Response(stream, { status: 200, headers: { "content-type": "application/json; charset=utf-8", "Cache-Control": "no-store, max-age=0", "X-Accel-Buffering": "no" } });
}

async function callWorkerWithRetry(workerClient: WorkerClient, body: InterviewRequest, signal: AbortSignal, secret: string, retryDelay: RetryDelay): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_WORKER_ATTEMPTS; attempt += 1) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    try {
      const response = await workerClient(body, signal, secret);
      if (response.status !== 502 || attempt === MAX_WORKER_ATTEMPTS) return response;
    } catch (error) {
      lastError = error;
      if (signal.aborted || !(error instanceof WorkerTransportError) || attempt === MAX_WORKER_ATTEMPTS) throw error;
    }
    await retryDelay(signal);
  }
  throw lastError instanceof Error ? lastError : new Error("worker_failed");
}

export function createInterviewRouteHandler(
  workerClient: WorkerClient = callWorker,
  retryDelay: RetryDelay = waitForWorkerRetry,
  heartbeatDelay: HeartbeatDelay = waitForHeartbeat,
  authorizeMobile?: (request: Request) => boolean | Promise<boolean>,
) {
  return async function POST(request: Request): Promise<Response> {
    if (authorizeMobile) {
      if (!(await authorizeMobile(request))) return error(401, "mobile_unauthorized", "Session mobile non autorisée.");
    } else {
      if (!safeEqual(request.headers.get("x-learning-os-mutation-secret"), process.env.CURRICULUM_MUTATION_SECRET)) return error(403, "mutation_unauthorized", "Mutation non autorisée.");
      if (!sameOrigin(request)) return error(403, "forbidden_origin", "Origine de mutation refusée.");
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error(415, "unsupported_media_type", "Le corps doit être en application/json.");
    let raw: unknown;
    try { raw = await boundedJson(request, MAX_INTERVIEW_BODY_BYTES); }
    catch (cause) { return cause instanceof TooLarge ? error(413, "body_too_large", "Entretien trop volumineux.") : error(400, "invalid_json", "Le corps JSON est invalide."); }
    const parsed = validateInterviewRequest(raw);
    if (!parsed.ok) return error(400, "invalid_interview", "L’état de l’entretien est invalide.");
    const secret = process.env.CODEX_INTERVIEW_WORKER_SECRET;
    if (!secret || secret.length < 32) return error(503, "interview_unavailable", "L’entretien Codex est indisponible.");
    const workerAborter = new AbortController();
    const signal = AbortSignal.any([request.signal, workerAborter.signal, AbortSignal.timeout(350_000)]);
    const operation = (async () => {
      try {
        const response = await callWorkerWithRetry(workerClient, parsed.value, signal, secret, retryDelay);
        if (!response.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return error(502, "worker_failed", "La génération a échoué.");
        if (!response.ok) {
          if (response.status === 400) {
            let workerError: unknown;
            try { workerError = await boundedJson(response, MAX_INTERVIEW_BODY_BYTES); } catch { workerError = null; }
            if ((workerError as { error?: unknown } | null)?.error === "invalid_state") {
              return error(410, "interview_state_expired", "La session d’entretien est invalide ou expirée. Recommence l’entretien.");
            }
            return error(502, "worker_failed", "La génération a échoué.");
          }
          if (response.status === 429) return error(429, "worker_busy", "Codex traite déjà une demande.");
          return error(502, "worker_failed", "La génération a échoué.");
        }
        const candidate = validateInterviewResponse(await boundedJson(response, MAX_INTERVIEW_BODY_BYTES));
        if (!candidate.ok) return error(502, "invalid_worker_response", "La génération a produit une réponse invalide.");
        return Response.json(candidate.value, { headers: { "Cache-Control": "no-store, max-age=0" } });
      } catch { return error(503, "interview_unavailable", "L’entretien Codex est indisponible."); }
    })();
    return responseWithHeartbeat(operation, workerAborter, heartbeatDelay);
  };
}

export function createMobileInterviewRouteHandler(
  workerClient: WorkerClient = callWorker,
  retryDelay: RetryDelay = waitForWorkerRetry,
  heartbeatDelay: HeartbeatDelay = waitForHeartbeat,
  auth: SessionVerifier = scioAuthStoreFromEnvironment(),
) {
  return createInterviewRouteHandler(
    workerClient,
    retryDelay,
    heartbeatDelay,
    (request) => mobileBearerAuthorized(request, auth),
  );
}
