import * as SecureStore from 'expo-secure-store';

import type { Locale } from './i18n';
import { parseEngineInterviewResponse, type EngineInterviewResponse } from './engine-interview';
import { resolveEngineUrl } from './engine-url';
import { authAccessTokenKey } from './secure-store-keys';
import { emitSessionExpired } from './session-expiration';

export type EngineInterviewRequest =
  | { locale: Locale }
  | { state: string; answer: string }
  | { state: string; action: 'confirm' }
  | { state: string; action: 'revise'; answer: string };

export type { EngineInterviewResponse } from './engine-interview';

export class EngineApiError extends Error {
  constructor(public readonly code: 'configuration' | 'unauthorized' | 'busy' | 'network' | 'invalid' | 'expired') {
    super(code);
    this.name = 'EngineApiError';
  }
}

function engineUrl(): string {
  try {
    return resolveEngineUrl(process.env.EXPO_PUBLIC_ENGINE_URL);
  } catch {
    throw new EngineApiError('configuration');
  }
}


async function parseResponse(response: Response): Promise<unknown> {
  const body = (await response.text()).trim();
  if (!body) throw new EngineApiError('invalid');
  try {
    return JSON.parse(body);
  } catch {
    throw new EngineApiError('invalid');
  }
}

export async function sendEngineInterview(request: EngineInterviewRequest): Promise<EngineInterviewResponse> {
  const token = await SecureStore.getItemAsync(authAccessTokenKey).catch(() => null);
  if (!token) throw new EngineApiError('unauthorized');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 360_000);
  try {
    const response = await fetch(`${engineUrl()}/curriculum/interview`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (response.status === 401 || response.status === 403) {
      emitSessionExpired();
      throw new EngineApiError('unauthorized');
    }
    if (response.status === 410) throw new EngineApiError('expired');
    if (response.status === 429) throw new EngineApiError('busy');
    if (!response.ok) throw new EngineApiError('network');
    const payload = await parseResponse(response);
    try {
      return parseEngineInterviewResponse(payload);
    } catch {
      throw new EngineApiError('invalid');
    }
  } catch (error) {
    if (error instanceof EngineApiError) throw error;
    throw new EngineApiError('network');
  } finally {
    clearTimeout(timeout);
  }
}

export async function beginEngineInterview(locale: Locale, subject: string): Promise<EngineInterviewResponse> {
  const normalizedSubject = subject.trim();
  if (normalizedSubject.length < 2 || normalizedSubject.length > 2_000) {
    throw new EngineApiError('invalid');
  }
  const opening = await sendEngineInterview({ locale });
  if (opening.phase !== 'question') throw new EngineApiError('invalid');
  return sendEngineInterview({ state: opening.state, answer: normalizedSubject });
}
