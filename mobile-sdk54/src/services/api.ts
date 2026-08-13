import * as SecureStore from 'expo-secure-store';

import { AuthenticatedFetchError, createAuthenticatedFetch } from '../lib/authenticated-fetch';
import { resolveApiConfiguration, type ApiConfiguration } from '../lib/api-url';
import { parseCardsDto, parseCurriculumDto, parseExercisesDto, parseProgressDto } from '../lib/dto-validation';
import { authAccessTokenKey } from '../lib/secure-store-keys';
import { emitSessionExpired } from '../lib/session-expiration';
import type { Curriculum, Exercise, Progress, ReviewCard, ScioData } from '../types/scio';

export type ApiErrorCode = 'timeout' | 'network' | 'unauthorized' | 'rate_limited' | 'server' | 'unexpected';

export class ApiError extends Error {
  constructor(public readonly code: ApiErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'ApiError';
  }
}

export type ProgressMutation = {
  eventId: string;
  lessonId?: string;
  exerciseId?: string;
  status: 'completed' | 'passed';
};

export type CardMutation = {
  eventId: string;
  cardId: string;
  result: 'recalled' | 'again';
};

export type NoteMutation = {
  lessonId: string;
  body: string;
};

const requestTimeoutMs = 12_000;
const authenticatedFetch = createAuthenticatedFetch({
  getToken: () => SecureStore.getItemAsync(authAccessTokenKey),
  fetchImpl: (url, init) => fetch(url, init),
});

export function getApiConfiguration(): ApiConfiguration {
  return resolveApiConfiguration(
    process.env.EXPO_PUBLIC_API_URL,
    __DEV__,
  );
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await requestResponse(baseUrl, path, init);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

async function requestResponse(baseUrl: string, path: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const headers = new Headers(init?.headers);
    headers.set('Accept', 'application/json');
    if (init?.body) headers.set('Content-Type', 'application/json');
    const response = await authenticatedFetch(`${baseUrl}/${path}`, {
      ...init,
      signal: controller.signal,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        emitSessionExpired();
        throw new ApiError('unauthorized');
      }
      if (response.status === 429) {
        throw new ApiError('rate_limited');
      }
      if (response.status >= 500) {
        throw new ApiError('server');
      }
      throw new ApiError('unexpected', `HTTP_${response.status}`);
    }

    return response;
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }
    if (error instanceof AuthenticatedFetchError) {
      emitSessionExpired();
      throw new ApiError('unauthorized');
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('timeout');
    }
    throw new ApiError('network');
  } finally {
    clearTimeout(timeout);
  }
}

export async function getCurriculum(baseUrl: string): Promise<Curriculum | null> {
  return (await getCurriculumSnapshot(baseUrl)).curriculum;
}

function responseRevision(response: Response): string {
  const revision = response.headers.get('etag');
  if (!revision || !/^"[a-f0-9]{64}"$/.test(revision)) throw new Error('DTO_CURRICULUM_REVISION_INVALID');
  return revision;
}

export async function getCurriculumSnapshot(
  baseUrl: string,
): Promise<{ curriculum: Curriculum | null; revision: string }> {
  try {
    const response = await requestResponse(baseUrl, 'mobile/data/curriculum');
    const revision = responseRevision(response);
    if (response.status === 204) return { curriculum: null, revision };
    return { curriculum: parseCurriculumDto(await response.json()), revision };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unexpected', 'DTO_CURRICULUM_INVALID');
  }
}

function requireNoContent(response: Response): void {
  if (response.status !== 204) throw new ApiError('unexpected', `HTTP_${response.status}`);
}

export async function deleteCurriculum(baseUrl: string, revision: string): Promise<string> {
  const response = await requestResponse(baseUrl, 'mobile/data/curriculum', {
    method: 'DELETE',
    headers: { 'If-Match': revision },
  });
  requireNoContent(response);
  return responseRevision(response);
}

export async function replaceCurriculum(baseUrl: string, data: ScioData, revision: string): Promise<string> {
  const response = await requestResponse(baseUrl, 'mobile/data/curriculum', {
    method: 'PUT',
    headers: { 'If-Match': revision },
    body: JSON.stringify({
      curriculum: data.curriculum,
      exercises: data.exercises,
      cards: data.cards,
    }),
  });
  requireNoContent(response);
  return responseRevision(response);
}

export async function getCards(
  baseUrl: string,
): Promise<ReviewCard[] | { cards: ReviewCard[]; exercises?: Exercise[] }> {
  try {
    const payload = await request<unknown>(baseUrl, 'mobile/data/cards');
    if (Array.isArray(payload)) return parseCardsDto(payload);
    if (!payload || typeof payload !== 'object' || !('cards' in payload)) throw new Error();
    const candidate = payload as { cards: unknown; exercises?: unknown };
    return {
      cards: parseCardsDto(candidate.cards),
      ...(candidate.exercises === undefined ? {} : { exercises: parseExercisesDto(candidate.exercises) }),
    };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unexpected', 'DTO_CARDS_INVALID');
  }
}

export async function getProgress(baseUrl: string): Promise<Progress> {
  try {
    return parseProgressDto(await request<unknown>(baseUrl, 'mobile/data/progress'));
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unexpected', 'DTO_PROGRESS_INVALID');
  }
}

export function mutateProgress(baseUrl: string, mutation: ProgressMutation, revision: string): Promise<void> {
  return request(baseUrl, 'mobile/data/progress', {
    method: 'PATCH',
    headers: { 'If-Match': revision },
    body: JSON.stringify(mutation),
  });
}

export function mutateCard(baseUrl: string, mutation: CardMutation, revision: string): Promise<void> {
  return request(baseUrl, `mobile/data/cards/${encodeURIComponent(mutation.cardId)}`, {
    method: 'PATCH',
    headers: { 'If-Match': revision },
    body: JSON.stringify(mutation),
  });
}

export function createNote(baseUrl: string, mutation: NoteMutation, revision: string): Promise<void> {
  return request(baseUrl, 'mobile/data/notes', {
    method: 'POST',
    headers: { 'If-Match': revision },
    body: JSON.stringify(mutation),
  });
}
