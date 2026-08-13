import { bearerToken, errorResponse, noStoreJson } from './scio-auth';
import type { ScioSessionIdentity } from './scio-auth-store';
import {
  type createScioUserDataStore,
  UserDataStoreError,
} from './scio-user-data-store';
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

function emptyResponse(headers?: HeadersInit): Response {
  return new Response(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache', ...headers },
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

function mutationPrecondition(request: Request, data?: MobileContent):
  | { expectedCurriculumRevision: string; fallbackCurriculum?: MobileContent }
  | Response {
  const match = /^"([a-f0-9]{64})"$/.exec(request.headers.get('if-match') ?? '');
  if (!match) return errorResponse(428, 'curriculum_revision_required');
  return {
    expectedCurriculumRevision: match[1],
    ...(data ? { fallbackCurriculum: data } : {}),
  };
}

function stalePrecondition(
  precondition: { expectedCurriculumRevision: string },
  currentRevision: string,
): Response | null {
  return precondition.expectedCurriculumRevision === currentRevision
    ? null
    : errorResponse(412, 'curriculum_revision_mismatch');
}

function mutationError(error: unknown, fallbackCode: string): Response {
  if (error instanceof UserDataStoreError && error.code === 'curriculum_revision_mismatch') {
    return errorResponse(412, error.code);
  }
  return errorResponse(400, fallbackCode);
}

export function createMobileDataHandlers(dependencies: Dependencies) {
  async function requireIdentity(request: Request): Promise<ScioSessionIdentity | Response> {
    const resolved = await identity(request, dependencies);
    return resolved ?? errorResponse(401, 'session_unauthorized');
  }

  async function curriculumStateFor(userId: string): Promise<{
    content: MobileContent | null;
    revision: string;
  }> {
    const state = await dependencies.users.readCurriculumState(userId);
    if (state.status === 'empty') return { content: null, revision: state.revision };
    if (state.status === 'custom') {
      return { content: validateMobileContent(state.curriculum), revision: state.revision };
    }
    const content = await dependencies.loadDefaultData();
    return { content, revision: state.revision };
  }

  async function contentFor(userId: string): Promise<MobileContent | null> {
    return (await curriculumStateFor(userId)).content;
  }

  return {
    async getCurriculum(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const state = await curriculumStateFor(session.user.id);
      return state.content
        ? noStoreJson(state.content.curriculum, { headers: { ETag: `"${state.revision}"` } })
        : emptyResponse({ ETag: `"${state.revision}"` });
    },

    async putCurriculum(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const requestedPrecondition = mutationPrecondition(request);
      if (requestedPrecondition instanceof Response) return requestedPrecondition;
      const state = await curriculumStateFor(session.user.id);
      const stale = stalePrecondition(requestedPrecondition, state.revision);
      if (stale) return stale;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      try {
        const content = validateMobileContent(value);
        const precondition = {
          ...requestedPrecondition,
          ...(state.content ? { fallbackCurriculum: state.content } : {}),
        };
        const revision = await dependencies.users.saveCurriculum(session.user.id, content, precondition);
        return emptyResponse({ ETag: `"${revision}"` });
      } catch (error) {
        if (error instanceof UserDataStoreError && error.code === 'curriculum_revision_mismatch') {
          return errorResponse(412, error.code);
        }
        return errorResponse(422, 'invalid_curriculum');
      }
    },

    async deleteCurriculum(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const requestedPrecondition = mutationPrecondition(request);
      if (requestedPrecondition instanceof Response) return requestedPrecondition;
      const state = await curriculumStateFor(session.user.id);
      const stale = stalePrecondition(requestedPrecondition, state.revision);
      if (stale) return stale;
      const precondition = {
        ...requestedPrecondition,
        ...(state.content ? { fallbackCurriculum: state.content } : {}),
      };
      try {
        const revision = await dependencies.users.clearCurriculum(
          session.user.id,
          state.content ?? undefined,
          precondition,
        );
        return emptyResponse({ ETag: `"${revision}"` });
      } catch (error) {
        if (error instanceof UserDataStoreError && error.code === 'curriculum_revision_mismatch') {
          return errorResponse(412, error.code);
        }
        return errorResponse(409, 'curriculum_archive_failed');
      }
    },

    async getCards(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const data = await contentFor(session.user.id);
      return noStoreJson({ cards: data?.cards ?? [], exercises: data?.exercises ?? [] });
    },

    async getProgress(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      return noStoreJson(await dependencies.users.readProgress(session.user.id));
    },

    async patchProgress(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const requestedPrecondition = mutationPrecondition(request);
      if (requestedPrecondition instanceof Response) return requestedPrecondition;
      const state = await curriculumStateFor(session.user.id);
      const stale = stalePrecondition(requestedPrecondition, state.revision);
      if (stale) return stale;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      if (!value || typeof value !== 'object') return errorResponse(400, 'invalid_mutation');
      const mutation = value as { eventId?: unknown; lessonId?: unknown; exerciseId?: unknown; status?: unknown };
      const data = state.content;
      if (!data) return errorResponse(404, 'curriculum_not_found');
      const precondition = { ...requestedPrecondition, fallbackCurriculum: data };
      if (mutation.status === 'completed' &&
          (typeof mutation.lessonId !== 'string' || !lessonIds(data).has(mutation.lessonId))) {
        return errorResponse(404, 'lesson_not_found');
      }
      if (mutation.status === 'passed' &&
          (typeof mutation.exerciseId !== 'string' || !data.exercises.some((item) => item.id === mutation.exerciseId))) {
        return errorResponse(404, 'exercise_not_found');
      }
      try {
        await dependencies.users.applyProgress(
          session.user.id,
          mutation as Parameters<Dependencies['users']['applyProgress']>[1],
          precondition,
        );
        return emptyResponse();
      } catch (error) {
        return mutationError(error, 'invalid_mutation');
      }
    },

    async patchCard(request: Request, cardId: string): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const requestedPrecondition = mutationPrecondition(request);
      if (requestedPrecondition instanceof Response) return requestedPrecondition;
      const state = await curriculumStateFor(session.user.id);
      const stale = stalePrecondition(requestedPrecondition, state.revision);
      if (stale) return stale;
      const data = state.content;
      if (!data) return errorResponse(404, 'curriculum_not_found');
      const precondition = { ...requestedPrecondition, fallbackCurriculum: data };
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
        await dependencies.users.applyCard(
          session.user.id,
          mutation as Parameters<Dependencies['users']['applyCard']>[1],
          precondition,
        );
        return emptyResponse();
      } catch (error) {
        return mutationError(error, 'invalid_mutation');
      }
    },

    async postNote(request: Request): Promise<Response> {
      const session = await requireIdentity(request);
      if (session instanceof Response) return session;
      const requestedPrecondition = mutationPrecondition(request);
      if (requestedPrecondition instanceof Response) return requestedPrecondition;
      const state = await curriculumStateFor(session.user.id);
      const stale = stalePrecondition(requestedPrecondition, state.revision);
      if (stale) return stale;
      let value: unknown;
      try {
        value = await boundedJson(request);
      } catch (error) {
        return bodyError(error);
      }
      if (!value || typeof value !== 'object') return errorResponse(400, 'invalid_note');
      const note = value as { lessonId?: unknown; body?: unknown };
      const data = state.content;
      if (!data) return errorResponse(404, 'curriculum_not_found');
      const precondition = { ...requestedPrecondition, fallbackCurriculum: data };
      if (typeof note.lessonId !== 'string' || !lessonIds(data).has(note.lessonId)) {
        return errorResponse(404, 'lesson_not_found');
      }
      try {
        await dependencies.users.saveNote(
          session.user.id,
          note as Parameters<Dependencies['users']['saveNote']>[1],
          precondition,
        );
        return emptyResponse();
      } catch (error) {
        return mutationError(error, 'invalid_note');
      }
    },
  };
}
