import { bearerToken, errorResponse, noStoreJson } from './scio-auth';
import type { ScioSessionIdentity } from './scio-auth-store';
import type { createScioUserDataStore } from './scio-user-data-store';
import { validateMobileContent, type MobileContent } from './mobile-data-validation';

type Dependencies = {
  auth: { verifySession: (token: string) => Promise<ScioSessionIdentity | null> };
  users: ReturnType<typeof createScioUserDataStore>;
  loadDefaultData: () => Promise<MobileContent>;
};

const maxBodyBytes = 64 * 1024;

async function identity(request: Request, dependencies: Dependencies): Promise<ScioSessionIdentity | null> {
  const token = bearerToken(request);
  return token ? dependencies.auth.verifySession(token) : null;
}

async function boundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    throw new Error('unsupported_media_type');
  }
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBodyBytes) throw new Error('body_too_large');
  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > maxBodyBytes) throw new Error('body_too_large');
  return JSON.parse(body) as unknown;
}

function emptyResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' },
  });
}

function bodyError(error: unknown): Response {
  const code = error instanceof Error ? error.message : 'invalid_body';
  if (code === 'unsupported_media_type') return errorResponse(415, code);
  if (code === 'body_too_large') return errorResponse(413, code);
  return errorResponse(400, 'invalid_body');
}

function lessonIds(data: MobileContent): Set<string> {
  return new Set(data.curriculum.course.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
}

export function createMobileDataHandlers(dependencies: Dependencies) {
  async function requireIdentity(request: Request): Promise<ScioSessionIdentity | Response> {
    const resolved = await identity(request, dependencies);
    return resolved ?? errorResponse(401, 'session_unauthorized');
  }

  async function contentFor(userId: string): Promise<MobileContent> {
    const stored = await dependencies.users.readCurriculum(userId);
    return stored ? validateMobileContent(stored) : dependencies.loadDefaultData();
  }

  return {
    async getCurriculum(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      return noStoreJson((await contentFor(session.user.id)).curriculum);
    },

    async putCurriculum(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      try {
        const content = validateMobileContent(value);
        await dependencies.users.saveCurriculum(session.user.id, content);
        return emptyResponse();
      } catch {
        return errorResponse(422, 'invalid_curriculum');
      }
    },

    async getCards(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const data = await contentFor(session.user.id);
      return noStoreJson({ cards: data.cards, exercises: data.exercises });
    },

    async getProgress(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      return noStoreJson(await dependencies.users.readProgress(session.user.id));
    },

    async patchProgress(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      if (!value || typeof value !== 'object') return errorResponse(400, 'invalid_mutation');
      const mutation = value as { eventId?: unknown; lessonId?: unknown; exerciseId?: unknown; status?: unknown };
      const data = await contentFor(session.user.id);
      if (mutation.status === 'completed' &&
          (typeof mutation.lessonId !== 'string' || !lessonIds(data).has(mutation.lessonId))) {
        return errorResponse(404, 'lesson_not_found');
      }
      if (mutation.status === 'passed' &&
          (typeof mutation.exerciseId !== 'string' || !data.exercises.some((item) => item.id === mutation.exerciseId))) {
        return errorResponse(404, 'exercise_not_found');
      }
      try {
        await dependencies.users.applyProgress(session.user.id, mutation as Parameters<Dependencies['users']['applyProgress']>[1]);
        return emptyResponse();
      } catch {
        return errorResponse(400, 'invalid_mutation');
      }
    },

    async patchCard(request: Request, cardId: string): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const data = await contentFor(session.user.id);
      if (!data.cards.some((item) => item.id === cardId)) return errorResponse(404, 'card_not_found');
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      if (!value || typeof value !== 'object') return errorResponse(400, 'invalid_mutation');
      const mutation = value as { eventId?: unknown; cardId?: unknown; result?: unknown };
      if (mutation.cardId !== cardId) return errorResponse(400, 'card_id_mismatch');
      try {
        await dependencies.users.applyCard(session.user.id, mutation as Parameters<Dependencies['users']['applyCard']>[1]);
        return emptyResponse();
      } catch {
        return errorResponse(400, 'invalid_mutation');
      }
    },

    async postNote(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      if (!value || typeof value !== 'object') return errorResponse(400, 'invalid_note');
      const note = value as { lessonId?: unknown; body?: unknown };
      const data = await contentFor(session.user.id);
      if (typeof note.lessonId !== 'string' || !lessonIds(data).has(note.lessonId)) {
        return errorResponse(404, 'lesson_not_found');
      }
      try {
        await dependencies.users.saveNote(session.user.id, note as Parameters<Dependencies['users']['saveNote']>[1]);
        return emptyResponse();
      } catch {
        return errorResponse(400, 'invalid_note');
      }
    },
  };
}
