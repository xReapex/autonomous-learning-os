import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import curriculum from "../../../../../content/curriculum.json";
import { createInterviewRouteHandler, WorkerTransportError } from "./handler";

const state = "s".repeat(40);
const validBody = {};
const headers = { "content-type": "application/json", origin: "https://learning.example", "sec-fetch-site": "same-origin", "x-learning-os-mutation-secret": "m".repeat(32) };
function request(body: unknown = validBody, custom: Record<string, string> = headers) { return new Request("https://learning.example/api/curriculum/interview", { method: "POST", headers: custom, body: JSON.stringify(body) }); }

describe("POST /api/curriculum/interview", () => {
  beforeEach(() => { process.env.APP_URL = "https://learning.example"; process.env.CURRICULUM_MUTATION_SECRET = "m".repeat(32); process.env.CODEX_INTERVIEW_WORKER_SECRET = "w".repeat(32); });
  afterEach(() => vi.restoreAllMocks());

  it.each([["autorisation", { ...headers, "x-learning-os-mutation-secret": "x".repeat(32) }, 403], ["origine", { ...headers, origin: "https://evil.example" }, 403], ["type", { ...headers, "content-type": "text/plain" }, 415]] as const)("refuse une mauvaise %s", async (_label, custom, status) => {
    const response = await createInterviewRouteHandler(vi.fn())(request(validBody, custom)); expect(response.status).toBe(status); expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("borne réellement le flux sans Content-Length", async () => {
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`{"answer":"${"x".repeat(70_000)}","state":"${state}"}`)); controller.close(); } });
    const oversized = new Request("https://learning.example/api/curriculum/interview", { method: "POST", headers, body: stream, duplex: "half" } as RequestInit);
    expect((await createInterviewRouteHandler(vi.fn())(oversized)).status).toBe(413);
  });

  it.each([[null, 400], [{ state: "court", answer: "x" }, 400], [{ state, answer: "x", extra: true }, 400]] as const)("refuse un état malformé", async (body, status) => { expect((await createInterviewRouteHandler(vi.fn())(request(body))).status).toBe(status); });

  it("retourne une erreur contrôlée si le worker est indisponible", async () => {
    const client = vi.fn().mockRejectedValue(new Error("internal path"));
    const response = await createInterviewRouteHandler(client, vi.fn().mockResolvedValue(undefined))(request()); expect(response.status).toBe(503); expect(await response.text()).not.toContain("internal path"); expect(client).toHaveBeenCalledTimes(1);
  });

  it("réessaie de façon bornée les échecs transitoires avant de répondre au navigateur", async () => {
    const client = vi.fn()
      .mockRejectedValueOnce(new WorkerTransportError())
      .mockResolvedValueOnce(Response.json({ error: "generation_failed" }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ phase: "question", message: "Que sais-tu déjà faire concrètement dans ce domaine ?", choices: ["Je débute", "Je connais les bases", "Je pratique déjà"], progress: 25, document: null, state }));
    const delay = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, delay)(request());
    expect(response.status).toBe(200);
    expect(client).toHaveBeenCalledTimes(3);
    expect(delay).toHaveBeenCalledTimes(2);
  });

  it("maintient une génération longue active avec des espaces JSON de heartbeat", async () => {
    let finish!: (response: Response) => void;
    const client = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const heartbeat = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, vi.fn(), heartbeat)(request({ state, action: "confirm" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("x-accel-buffering")).toBe("no");
    const body = response.text();
    finish(Response.json({ phase: "proposal", message: "Proposition prête.", choices: [], progress: 100, document: curriculum, state }));
    const text = await body;
    expect(text.startsWith("\n")).toBe(true);
    expect(JSON.parse(text).phase).toBe("proposal");
  });

  it("annule un heartbeat sans réécrire dans un stream fermé", async () => {
    let finish!: (response: Response) => void;
    let workerSignal!: AbortSignal;
    const client = vi.fn((_body, signal: AbortSignal) => {
      workerSignal = signal;
      return new Promise<Response>((resolve) => { finish = resolve; });
    });
    const response = await createInterviewRouteHandler(client, vi.fn(), vi.fn().mockResolvedValue(undefined))(request({ state, action: "confirm" }));
    const reader = response.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    await reader.cancel();
    expect(workerSignal.aborted).toBe(true);
    finish(Response.json({ phase: "proposal", message: "Proposition prête.", choices: [], progress: 100, document: curriculum, state }));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("n’écrit pas si l’annulation survient pendant la lecture asynchrone du résultat", async () => {
    let finish!: (response: Response) => void;
    let releaseRead!: () => void;
    let readingStarted!: () => void;
    const reading = new Promise<void>((resolve) => { readingStarted = resolve; });
    const gate = new Promise<void>((resolve) => { releaseRead = resolve; });
    const originalArrayBuffer = Response.prototype.arrayBuffer;
    vi.spyOn(Response.prototype, "arrayBuffer").mockImplementation(async function (this: Response) {
      readingStarted();
      await gate;
      return originalArrayBuffer.call(this);
    });
    const client = vi.fn(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const response = await createInterviewRouteHandler(client, vi.fn(), vi.fn().mockResolvedValue(undefined))(request({ state, action: "confirm" }));
    const reader = response.body!.getReader();
    expect((await reader.read()).done).toBe(false);
    finish(Response.json({ phase: "proposal", message: "Proposition prête.", choices: [], progress: 100, document: curriculum, state }));
    await reading;
    await reader.cancel();
    releaseRead();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it("signale explicitement un état worker expiré sans retry", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ error: "invalid_state" }, { status: 400 }));
    const delay = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, delay)(request({ state, action: "confirm" }));
    expect(response.status).toBe(410);
    expect(await response.text()).toContain("expir");
    expect(client).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("ne transforme pas une requête worker invalide en expiration", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ error: "invalid_request" }, { status: 400 }));
    const response = await createInterviewRouteHandler(client)(request());
    expect(response.status).toBe(502);
    expect(await response.text()).toContain("worker_failed");
  });

  it("ne multiplie pas les appels après les deux générations finales bornées du worker", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ error: "generation_failed" }, { status: 422 }));
    const delay = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, delay)(request({ state, action: "confirm" }));
    expect(response.status).toBe(502);
    expect(client).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("ne réessaie jamais un worker occupé", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ error: "busy" }, { status: 429 }));
    const delay = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, delay)(request());
    expect(response.status).toBe(429);
    expect(client).toHaveBeenCalledTimes(1);
    expect(delay).not.toHaveBeenCalled();
  });

  it("réessaie une confirmation désormais idempotente côté worker", async () => {
    const client = vi.fn()
      .mockResolvedValueOnce(Response.json({ error: "generation_failed" }, { status: 502 }))
      .mockResolvedValueOnce(Response.json({ phase: "proposal", message: "Proposition prête.", choices: [], progress: 100, document: curriculum, state }));
    const delay = vi.fn().mockResolvedValue(undefined);
    const response = await createInterviewRouteHandler(client, delay)(request({ state, action: "confirm" }));
    expect(response.status).toBe(200);
    expect(client).toHaveBeenCalledTimes(2);
    expect(delay).toHaveBeenCalledTimes(1);
  });

  it("ne contacte pas le worker si le navigateur est déjà parti", async () => {
    const controller = new AbortController(); controller.abort();
    const client = vi.fn();
    const browserRequest = new Request("https://learning.example/api/curriculum/interview", { method: "POST", headers, body: "{}", signal: controller.signal });
    expect((await createInterviewRouteHandler(client, vi.fn())(browserRequest)).status).toBe(503);
    expect(client).not.toHaveBeenCalled();
  });

  it("interrompt le retry pendant son délai si le navigateur part", async () => {
    const controller = new AbortController();
    let delayStarted!: () => void;
    const started = new Promise<void>((resolve) => { delayStarted = resolve; });
    const client = vi.fn().mockResolvedValue(Response.json({ error: "generation_failed" }, { status: 502 }));
    const delay = vi.fn((signal: AbortSignal) => new Promise<void>((_resolve, reject) => {
      delayStarted();
      signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    }));
    const browserRequest = new Request("https://learning.example/api/curriculum/interview", { method: "POST", headers, body: "{}", signal: controller.signal });
    const pending = createInterviewRouteHandler(client, delay)(browserRequest);
    await started; controller.abort();
    expect((await pending).status).toBe(503);
    expect(client).toHaveBeenCalledTimes(1);
  });

  it("transmet seulement l’état validé avec le secret serveur et accepte une question", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ phase: "question", message: "Que sais-tu déjà faire concrètement dans ce domaine ?", choices: ["Je débute", "Je connais les bases", "Je pratique déjà"], progress: 25, document: null, state }));
    const response = await createInterviewRouteHandler(client)(request()); expect(response.status).toBe(200);
    expect(client.mock.calls[0][0]).toEqual({}); expect(client.mock.calls[0][2]).toBe("w".repeat(32));
  });

  it("accepte une proposition valide et refuse une proposition invalide", async () => {
    const valid = createInterviewRouteHandler(vi.fn().mockResolvedValue(Response.json({ phase: "proposal", message: "Proposition prête.", choices: [], progress: 100, document: curriculum, state }))); expect((await valid(request())).status).toBe(200);
    const invalidDocument = structuredClone(curriculum); invalidDocument.subjects[0].lessons[0].source.url = "http://unsafe.example";
    const invalid = createInterviewRouteHandler(vi.fn().mockResolvedValue(Response.json({ phase: "proposal", message: "Proposition", progress: 100, document: invalidDocument, state }))); expect((await invalid(request())).status).toBe(502);
  });

  it("transmet une correction avec son état opaque sans transcript forgé", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ phase: "question", message: "Que sais-tu déjà faire concrètement dans ce domaine ?", choices: ["Je débute", "Je connais les bases", "Je pratique déjà"], progress: 35, document: null, state }));
    const body = { state, answer: "Je maîtrise déjà les bases." };
    expect((await createInterviewRouteHandler(client)(request(body))).status).toBe(200);
    expect(client.mock.calls[0][0]).toEqual(body);
  });

  it("transmet une confirmation explicite et accepte la phase de résumé", async () => {
    const client = vi.fn().mockResolvedValue(Response.json({ phase: "confirmation", message: "Résumé complet à confirmer.", choices: [], progress: 90, document: null, state }));
    const body = { state, action: "confirm" };
    expect((await createInterviewRouteHandler(client)(request(body))).status).toBe(200);
    expect(client.mock.calls[0][0]).toEqual(body);
  });

  it("propage l’abandon du navigateur au worker", async () => {
    const controller = new AbortController();
    let workerSignal: AbortSignal | undefined;
    let started!: () => void; const workerStarted = new Promise<void>((resolve) => { started = resolve; });
    const client = vi.fn(async (_body, signal: AbortSignal) => {
      workerSignal = signal; started();
      await new Promise((_resolve, reject) => signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true }));
      return Response.json({});
    });
    const browserRequest = new Request("https://learning.example/api/curriculum/interview", { method: "POST", headers, body: "{}", signal: controller.signal });
    const pending = createInterviewRouteHandler(client)(browserRequest); await workerStarted; controller.abort();
    expect((await pending).status).toBe(503);
    expect(workerSignal?.aborted).toBe(true);
  });
});
