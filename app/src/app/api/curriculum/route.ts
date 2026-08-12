import { timingSafeEqual } from "node:crypto";

import {
  createCurriculumStore,
  curriculumStore,
  CurriculumRevisionError,
  CurriculumValidationError,
  MAX_CURRICULUM_BYTES,
} from "@/lib/curriculum-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CurriculumStore = ReturnType<typeof createCurriculumStore>;

function activeResponse(active: Awaited<ReturnType<CurriculumStore["load"]>>): Response {
  return Response.json(active, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      ETag: `"${active.revision}"`,
    },
  });
}

function mutationOriginAllowed(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;

  const origin = request.headers.get("origin");
  const configuredOrigin = process.env.APP_URL;
  if (!origin || !configuredOrigin) return false;

  try {
    return new URL(origin).origin === new URL(configuredOrigin).origin;
  } catch {
    return false;
  }
}

function mutationAuthorized(request: Request): boolean {
  const expected = process.env.CURRICULUM_MUTATION_SECRET;
  const received = request.headers.get("x-learning-os-mutation-secret");
  if (!expected || !received) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length >= 32 &&
    expectedBytes.length === receivedBytes.length &&
    timingSafeEqual(expectedBytes, receivedBytes);
}

class RequestBodyTooLargeError extends Error {}

async function readBoundedJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_CURRICULUM_BYTES) {
    throw new RequestBodyTooLargeError();
  }
  if (!request.body) throw new SyntaxError("empty body");

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_CURRICULUM_BYTES) {
      await reader.cancel();
      throw new RequestBodyTooLargeError();
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
}

function parseIfMatch(request: Request): string | undefined {
  const raw = request.headers.get("if-match")?.trim();
  if (!raw) return undefined;
  return /^"([a-f0-9]{64})"$/.exec(raw)?.[1] ?? "";
}

function errorResponse(status: number, code: string, message: string, issues?: string[]): Response {
  return Response.json(
    { error: { code, message, ...(issues ? { issues } : {}) } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function createCurriculumRouteHandlers(store: CurriculumStore) {
  async function GET(): Promise<Response> {
    return activeResponse(await store.load());
  }

  async function PUT(request: Request): Promise<Response> {
    if (!mutationAuthorized(request)) {
      return errorResponse(403, "mutation_unauthorized", "Mutation non autorisée.");
    }
    if (!mutationOriginAllowed(request)) {
      return errorResponse(403, "forbidden_origin", "Origine de mutation refusée.");
    }
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return errorResponse(415, "unsupported_media_type", "Le corps doit être en application/json.");
    }

    const expectedRevision = parseIfMatch(request);
    if (expectedRevision === undefined) {
      return errorResponse(428, "precondition_required", "L'en-tête If-Match est obligatoire.");
    }
    if (!expectedRevision) {
      return errorResponse(400, "invalid_if_match", "L'en-tête If-Match est invalide.");
    }

    let candidate: unknown;
    try {
      candidate = await readBoundedJson(request);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        return errorResponse(413, "body_too_large", "Le curriculum dépasse 1 Mio.");
      }
      return errorResponse(400, "invalid_json", "Le corps JSON est invalide.");
    }

    try {
      return activeResponse(await store.replace(candidate, expectedRevision));
    } catch (error) {
      if (error instanceof CurriculumRevisionError) {
        return errorResponse(412, "revision_conflict", error.message);
      }
      if (error instanceof CurriculumValidationError) {
        return errorResponse(422, "invalid_curriculum", error.message, error.issues);
      }
      const code = typeof error === "object" && error !== null && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "unknown";
      console.error(JSON.stringify({ event: "curriculum_write_failed", reason: error instanceof Error ? error.name : "unknown", code }));
      return errorResponse(500, "write_failed", "La sauvegarde a échoué.");
    }
  }

  async function DELETE(request: Request): Promise<Response> {
    if (!mutationAuthorized(request)) {
      return errorResponse(403, "mutation_unauthorized", "Mutation non autorisée.");
    }
    if (!mutationOriginAllowed(request)) {
      return errorResponse(403, "forbidden_origin", "Origine de mutation refusée.");
    }
    const expectedRevision = parseIfMatch(request);
    if (expectedRevision === undefined) {
      return errorResponse(428, "precondition_required", "L'en-tête If-Match est obligatoire.");
    }
    if (!expectedRevision) {
      return errorResponse(400, "invalid_if_match", "L'en-tête If-Match est invalide.");
    }
    try {
      return activeResponse(await store.reset(expectedRevision));
    } catch (error) {
      if (error instanceof CurriculumRevisionError) {
        return errorResponse(412, "revision_conflict", error.message);
      }
      return errorResponse(500, "reset_failed", "La réinitialisation a échoué.");
    }
  }

  return { GET, PUT, DELETE };
}

const handlers = createCurriculumRouteHandlers(curriculumStore);
export const GET = handlers.GET;
export const PUT = handlers.PUT;
export const DELETE = handlers.DELETE;
