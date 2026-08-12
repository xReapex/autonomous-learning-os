import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { withInterprocessFileLock } from './interprocess-file-lock';

export type SocialProvider = 'google' | 'apple';

export type ScioAuthUser = {
  id: string;
  displayName: string;
  provider: 'development' | SocialProvider;
};

export type ScioSessionIdentity = {
  user: ScioAuthUser;
  entitlement: 'demo';
  expiresAt: string;
};

export type IssuedScioSession = ScioSessionIdentity & { token: string };

type StoredSession = {
  userId: string;
  entitlement: 'demo';
  createdAt: string;
  expiresAt: string;
};

type StoredChallenge = {
  provider: SocialProvider;
  nonce: string;
  expiresAt: string;
};

type StoredReauthenticationChallenge = StoredChallenge & {
  userId: string;
  purpose: 'delete_account';
};

type StoredReauthenticationProof = {
  userId: string;
  purpose: 'delete_account';
  expiresAt: string;
};

type StoredAuth = {
  version: 3;
  users: Record<string, ScioAuthUser>;
  sessions: Record<string, StoredSession>;
  identities: Record<string, string>;
  challenges: Record<string, StoredChallenge>;
  reauthenticationChallenges: Record<string, StoredReauthenticationChallenge>;
  reauthenticationProofs: Record<string, StoredReauthenticationProof>;
};

type AuthStoreOptions = {
  dataDirectory: string;
  environment?: string;
  deploymentEnvironment: string;
  authMode: string | undefined;
  now?: () => Date;
  sessionTtlMs?: number;
  maxDevelopmentUsers?: number;
  tokenFactory?: () => string;
};

type AuthStoreErrorCode =
  | 'development_auth_forbidden'
  | 'development_capacity_reached'
  | 'social_auth_forbidden'
  | 'social_challenge_invalid'
  | 'reauthentication_invalid'
  | 'session_invalid'
  | 'storage_invalid';

export class AuthStoreError extends Error {
  constructor(public readonly code: AuthStoreErrorCode) {
    super(code);
    this.name = 'AuthStoreError';
  }
}

const writeQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(file: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(file) ?? Promise.resolve();
  const lockedTask = () => withInterprocessFileLock(`${file}.lock`, task);
  const next = previous.then(lockedTask, lockedTask);
  writeQueues.set(file, next.catch(() => undefined));
  return next;
}

function emptyStore(): StoredAuth {
  return {
    version: 3,
    users: {},
    sessions: {},
    identities: {},
    challenges: {},
    reauthenticationChallenges: {},
    reauthenticationProofs: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function parseStore(value: unknown): StoredAuth {
  if (!isRecord(value) || !isRecord(value.users) || !isRecord(value.sessions)) {
    throw new AuthStoreError('storage_invalid');
  }
  if (value.version === 1) {
    return {
      version: 3,
      users: value.users as Record<string, ScioAuthUser>,
      sessions: value.sessions as Record<string, StoredSession>,
      identities: {},
      challenges: {},
      reauthenticationChallenges: {},
      reauthenticationProofs: {},
    };
  }
  if (value.version === 2 && isRecord(value.identities) && isRecord(value.challenges)) {
    return {
      version: 3,
      users: value.users as Record<string, ScioAuthUser>,
      sessions: value.sessions as Record<string, StoredSession>,
      identities: value.identities as Record<string, string>,
      challenges: value.challenges as Record<string, StoredChallenge>,
      reauthenticationChallenges: {},
      reauthenticationProofs: {},
    };
  }
  if (
    value.version !== 3 ||
    !isRecord(value.identities) ||
    !isRecord(value.challenges) ||
    !isRecord(value.reauthenticationChallenges) ||
    !isRecord(value.reauthenticationProofs)
  ) {
    throw new AuthStoreError('storage_invalid');
  }
  return value as StoredAuth;
}

async function readStore(file: string): Promise<StoredAuth> {
  try {
    return parseStore(JSON.parse(await readFile(file, 'utf8')));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return emptyStore();
    if (error instanceof AuthStoreError) throw error;
    throw new AuthStoreError('storage_invalid');
  }
}

async function writeStore(file: string, value: StoredAuth): Promise<void> {
  await mkdir(join(file, '..'), { recursive: true, mode: 0o700 });
  const temporary = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await rename(temporary, file);
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function identityHash(provider: SocialProvider, subject: string): string {
  return createHash('sha256').update(`${provider}\u0000${subject}`).digest('hex');
}

function defaultToken(): string {
  return `scio_${randomBytes(32).toString('base64url')}`;
}

function removeExpiredSessions(store: StoredAuth, nowMs: number): void {
  for (const [hash, session] of Object.entries(store.sessions)) {
    if (Date.parse(session.expiresAt) <= nowMs) delete store.sessions[hash];
  }
  const activeUserIds = new Set(Object.values(store.sessions).map((session) => session.userId));
  for (const [userId, user] of Object.entries(store.users)) {
    if (user.provider === 'development' && !activeUserIds.has(userId)) delete store.users[userId];
  }
}

function removeExpiredChallenges(store: StoredAuth, nowMs: number): void {
  for (const [hash, challenge] of Object.entries(store.challenges)) {
    if (Date.parse(challenge.expiresAt) <= nowMs) delete store.challenges[hash];
  }
  for (const [hash, challenge] of Object.entries(store.reauthenticationChallenges)) {
    if (Date.parse(challenge.expiresAt) <= nowMs) delete store.reauthenticationChallenges[hash];
  }
  for (const [hash, proof] of Object.entries(store.reauthenticationProofs)) {
    if (Date.parse(proof.expiresAt) <= nowMs) delete store.reauthenticationProofs[hash];
  }
}

export function createScioAuthStore(options: AuthStoreOptions) {
  const file = join(options.dataDirectory, 'auth.json');
  const now = options.now ?? (() => new Date());
  const sessionTtlMs = options.sessionTtlMs ?? 24 * 60 * 60 * 1_000;
  const maxDevelopmentUsers = options.maxDevelopmentUsers ?? 25;
  const tokenFactory = options.tokenFactory ?? defaultToken;

  function socialAuthAllowed(): boolean {
    return options.deploymentEnvironment === 'production' && options.authMode === 'social';
  }

  function addSession(store: StoredAuth, user: ScioAuthUser, issuedAt: Date): IssuedScioSession {
    const token = tokenFactory();
    if (typeof token !== 'string' || token.length < 40) throw new AuthStoreError('session_invalid');
    const expiresAt = new Date(issuedAt.getTime() + sessionTtlMs).toISOString();
    store.sessions[tokenHash(token)] = {
      userId: user.id,
      entitlement: 'demo',
      createdAt: issuedAt.toISOString(),
      expiresAt,
    };
    return { token, user, entitlement: 'demo', expiresAt };
  }

  return {
    async issueDevelopmentSession(): Promise<IssuedScioSession> {
      if (options.deploymentEnvironment !== 'preview' || options.authMode !== 'development') {
        throw new AuthStoreError('development_auth_forbidden');
      }

      return enqueue(file, async () => {
        const store = await readStore(file);
        const issuedAt = now();
        removeExpiredSessions(store, issuedAt.getTime());
        const developmentUsers = Object.values(store.users).filter((user) => user.provider === 'development');
        if (developmentUsers.length >= maxDevelopmentUsers) {
          throw new AuthStoreError('development_capacity_reached');
        }
        const user = {
          id: `usr_${randomUUID().replaceAll('-', '')}`,
          displayName: 'Profil de développement',
          provider: 'development' as const,
        };
        store.users[user.id] = user;
        const session = addSession(store, user, issuedAt);
        await writeStore(file, store);
        return session;
      });
    },

    async issueSocialChallenge(provider: SocialProvider): Promise<{ state: string; nonce: string; expiresAt: string }> {
      if (!socialAuthAllowed()) throw new AuthStoreError('social_auth_forbidden');
      return enqueue(file, async () => {
        const store = await readStore(file);
        const issuedAt = now();
        removeExpiredChallenges(store, issuedAt.getTime());
        const state = randomBytes(32).toString('base64url');
        const nonce = randomBytes(32).toString('base64url');
        const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1_000).toISOString();
        store.challenges[tokenHash(state)] = { provider, nonce, expiresAt };
        await writeStore(file, store);
        return { state, nonce, expiresAt };
      });
    },

    async consumeSocialChallenge(provider: SocialProvider, state: string): Promise<{ nonce: string }> {
      if (!socialAuthAllowed() || typeof state !== 'string' || state.length < 40) {
        throw new AuthStoreError('social_challenge_invalid');
      }
      return enqueue(file, async () => {
        const store = await readStore(file);
        const consumedAt = now();
        removeExpiredChallenges(store, consumedAt.getTime());
        const hash = tokenHash(state);
        const challenge = store.challenges[hash];
        if (!challenge || challenge.provider !== provider || Date.parse(challenge.expiresAt) <= consumedAt.getTime()) {
          throw new AuthStoreError('social_challenge_invalid');
        }
        delete store.challenges[hash];
        await writeStore(file, store);
        return { nonce: challenge.nonce };
      });
    },

    async issueReauthenticationChallenge(
      token: string,
      provider: SocialProvider,
    ): Promise<{ state: string; nonce: string; expiresAt: string }> {
      if (!socialAuthAllowed() || typeof token !== 'string' || token.length < 40) {
        throw new AuthStoreError('reauthentication_invalid');
      }
      return enqueue(file, async () => {
        const store = await readStore(file);
        const issuedAt = now();
        removeExpiredChallenges(store, issuedAt.getTime());
        const session = store.sessions[tokenHash(token)];
        const user = session ? store.users[session.userId] : undefined;
        if (!session || Date.parse(session.expiresAt) <= issuedAt.getTime() || !user || user.provider !== provider) {
          throw new AuthStoreError('reauthentication_invalid');
        }
        const state = randomBytes(32).toString('base64url');
        const nonce = randomBytes(32).toString('base64url');
        const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1_000).toISOString();
        store.reauthenticationChallenges[tokenHash(state)] = {
          userId: user.id,
          provider,
          nonce,
          purpose: 'delete_account',
          expiresAt,
        };
        await writeStore(file, store);
        return { state, nonce, expiresAt };
      });
    },

    async consumeReauthenticationChallenge(
      token: string,
      provider: SocialProvider,
      state: string,
    ): Promise<{ nonce: string; userId: string }> {
      if (
        !socialAuthAllowed() ||
        typeof token !== 'string' || token.length < 40 ||
        typeof state !== 'string' || state.length < 40
      ) throw new AuthStoreError('reauthentication_invalid');
      return enqueue(file, async () => {
        const store = await readStore(file);
        const consumedAt = now();
        removeExpiredChallenges(store, consumedAt.getTime());
        const session = store.sessions[tokenHash(token)];
        const hash = tokenHash(state);
        const challenge = store.reauthenticationChallenges[hash];
        if (
          !session || Date.parse(session.expiresAt) <= consumedAt.getTime() ||
          !challenge || challenge.userId !== session.userId || challenge.provider !== provider ||
          challenge.purpose !== 'delete_account' || Date.parse(challenge.expiresAt) <= consumedAt.getTime()
        ) throw new AuthStoreError('reauthentication_invalid');
        delete store.reauthenticationChallenges[hash];
        await writeStore(file, store);
        return { nonce: challenge.nonce, userId: challenge.userId };
      });
    },

    async issueReauthenticationProof(
      token: string,
      provider: SocialProvider,
      subject: string,
      expectedUserId: string,
    ): Promise<{ proof: string; expiresAt: string }> {
      if (!subject || subject.length > 255) throw new AuthStoreError('reauthentication_invalid');
      return enqueue(file, async () => {
        const store = await readStore(file);
        const issuedAt = now();
        removeExpiredChallenges(store, issuedAt.getTime());
        const session = store.sessions[tokenHash(token)];
        const identityUserId = store.identities[identityHash(provider, subject)];
        if (
          !session || Date.parse(session.expiresAt) <= issuedAt.getTime() ||
          session.userId !== expectedUserId || identityUserId !== expectedUserId
        ) throw new AuthStoreError('reauthentication_invalid');
        const proof = `reauth_${randomBytes(32).toString('base64url')}`;
        const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1_000).toISOString();
        store.reauthenticationProofs[tokenHash(proof)] = {
          userId: expectedUserId,
          purpose: 'delete_account',
          expiresAt,
        };
        await writeStore(file, store);
        return { proof, expiresAt };
      });
    },

    async consumeReauthenticationProof(token: string, proof: string): Promise<void> {
      if (
        typeof token !== 'string' || token.length < 40 ||
        typeof proof !== 'string' || !/^reauth_[A-Za-z0-9_-]{40,}$/.test(proof)
      ) throw new AuthStoreError('reauthentication_invalid');
      await enqueue(file, async () => {
        const store = await readStore(file);
        const consumedAt = now();
        removeExpiredChallenges(store, consumedAt.getTime());
        const session = store.sessions[tokenHash(token)];
        const hash = tokenHash(proof);
        const storedProof = store.reauthenticationProofs[hash];
        if (
          !session || Date.parse(session.expiresAt) <= consumedAt.getTime() ||
          !storedProof || storedProof.userId !== session.userId ||
          storedProof.purpose !== 'delete_account' || Date.parse(storedProof.expiresAt) <= consumedAt.getTime()
        ) throw new AuthStoreError('reauthentication_invalid');
        delete store.reauthenticationProofs[hash];
        await writeStore(file, store);
      });
    },

    async issueSocialSession(provider: SocialProvider, subject: string): Promise<IssuedScioSession> {
      if (!socialAuthAllowed()) throw new AuthStoreError('social_auth_forbidden');
      if (!subject || subject.length > 255) {
        throw new AuthStoreError('session_invalid');
      }
      return enqueue(file, async () => {
        const store = await readStore(file);
        const issuedAt = now();
        removeExpiredSessions(store, issuedAt.getTime());
        const identity = identityHash(provider, subject);
        const existingId = store.identities[identity];
        const existing = existingId ? store.users[existingId] : undefined;
        const user: ScioAuthUser = existing && existing.provider === provider
          ? { ...existing, displayName: 'Compte SCIO' }
          : { id: `usr_${randomUUID().replaceAll('-', '')}`, displayName: 'Compte SCIO', provider };
        store.users[user.id] = user;
        store.identities[identity] = user.id;
        const session = addSession(store, user, issuedAt);
        await writeStore(file, store);
        return session;
      });
    },

    async verifySession(token: string): Promise<ScioSessionIdentity | null> {
      if (typeof token !== 'string' || token.length < 40) return null;
      const store = await readStore(file);
      const session = store.sessions[tokenHash(token)];
      if (!session || Date.parse(session.expiresAt) <= now().getTime()) return null;
      const user = store.users[session.userId];
      if (!user) return null;
      return { user, entitlement: session.entitlement, expiresAt: session.expiresAt };
    },


    async revokeSession(token: string): Promise<void> {
      if (typeof token !== 'string' || token.length < 40) return;
      await enqueue(file, async () => {
        const store = await readStore(file);
        delete store.sessions[tokenHash(token)];
        await writeStore(file, store);
      });
    },

    async deleteAccount(token: string): Promise<ScioAuthUser> {
      if (typeof token !== 'string' || token.length < 40) throw new AuthStoreError('session_invalid');
      return enqueue(file, async () => {
        const store = await readStore(file);
        const session = store.sessions[tokenHash(token)];
        if (!session || Date.parse(session.expiresAt) <= now().getTime()) {
          throw new AuthStoreError('session_invalid');
        }
        const user = store.users[session.userId];
        if (!user) throw new AuthStoreError('session_invalid');
        delete store.users[user.id];
        for (const [hash, candidate] of Object.entries(store.sessions)) {
          if (candidate.userId === user.id) delete store.sessions[hash];
        }
        for (const [identity, userId] of Object.entries(store.identities)) {
          if (userId === user.id) delete store.identities[identity];
        }
        await writeStore(file, store);
        return user;
      });
    },

    async deleteDevelopmentAccount(token: string): Promise<void> {
      if (typeof token !== 'string' || token.length < 40) throw new AuthStoreError('session_invalid');
      await enqueue(file, async () => {
        const store = await readStore(file);
        const session = store.sessions[tokenHash(token)];
        if (!session || Date.parse(session.expiresAt) <= now().getTime()) {
          throw new AuthStoreError('session_invalid');
        }
        const user = store.users[session.userId];
        if (!user || user.provider !== 'development') throw new AuthStoreError('session_invalid');
        delete store.users[user.id];
        for (const [hash, candidate] of Object.entries(store.sessions)) {
          if (candidate.userId === user.id) delete store.sessions[hash];
        }
        await writeStore(file, store);
      });
    },
  };
}
