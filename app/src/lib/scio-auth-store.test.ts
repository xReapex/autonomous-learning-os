import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { createScioAuthStore } from './scio-auth-store';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'scio-auth-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe('SCIO auth store', () => {
  it('autorise un build Node production lorsqu’il est déployé dans l’environnement preview', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'production',
      deploymentEnvironment: 'preview',
      authMode: 'development',
    });

    await expect(store.issueDevelopmentSession()).resolves.toMatchObject({ entitlement: 'demo' });
  });

  it('refuse toujours l’identité de développement en production', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'production',
      deploymentEnvironment: 'production',
      authMode: 'development',
    });

    await expect(store.issueDevelopmentSession()).rejects.toMatchObject({
      code: 'development_auth_forbidden',
    });
  });

  it('émet un jeton opaque et ne persiste que son empreinte', async () => {
    const dataDirectory = await temporaryDirectory();
    const token = 'scio_dev_0123456789abcdefghijklmnopqrstuvwxyzABCDEFG';
    const store = createScioAuthStore({
      dataDirectory,
      environment: 'development',
      deploymentEnvironment: 'preview',
      authMode: 'development',
      tokenFactory: () => token,
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    });

    const issued = await store.issueDevelopmentSession();
    expect(issued).toMatchObject({
      token,
      user: { provider: 'development' },
      entitlement: 'demo',
    });
    expect(issued.user.id).toMatch(/^usr_/);

    const onDisk = await readFile(join(dataDirectory, 'auth.json'), 'utf8');
    expect(onDisk).not.toContain(token);
    expect(onDisk).not.toContain('0123456789abcdefghijklmnopqrstuvwxyzABCDEFG');

    await expect(store.verifySession(token)).resolves.toMatchObject({
      user: issued.user,
      entitlement: 'demo',
    });
  });

  it('révoque immédiatement une session', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'preview',
      authMode: 'development',
    });
    const issued = await store.issueDevelopmentSession();

    await store.revokeSession(issued.token);

    await expect(store.verifySession(issued.token)).resolves.toBeNull();
  });

  it('rejette une session expirée', async () => {
    let now = new Date('2026-08-11T12:00:00.000Z');
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'preview',
      authMode: 'development',
      sessionTtlMs: 1_000,
      now: () => now,
    });
    const issued = await store.issueDevelopmentSession();
    now = new Date('2026-08-11T12:00:02.000Z');

    await expect(store.verifySession(issued.token)).resolves.toBeNull();
  });

  it('borne la session par défaut à vingt-quatre heures', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
      now: () => new Date('2026-08-11T12:00:00.000Z'),
    });

    const issued = await store.issueSocialSession('google', 'subject-ttl');

    expect(issued.expiresAt).toBe('2026-08-12T12:00:00.000Z');
  });

  it('lie la réauthentification sensible à la session et au même provider/sub', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
    });
    const current = await store.issueSocialSession('google', 'subject-current');
    const other = await store.issueSocialSession('google', 'subject-other');
    const challenge = await store.issueReauthenticationChallenge(current.token, 'google');
    const consumed = await store.consumeReauthenticationChallenge(current.token, 'google', challenge.state);

    await expect(store.issueReauthenticationProof(
      current.token,
      'google',
      'subject-other',
      consumed.userId,
    )).rejects.toMatchObject({ code: 'reauthentication_invalid' });
    await expect(store.verifySession(current.token)).resolves.toMatchObject({ user: current.user });
    await expect(store.verifySession(other.token)).resolves.toMatchObject({ user: other.user });

    const secondChallenge = await store.issueReauthenticationChallenge(current.token, 'google');
    const secondConsumed = await store.consumeReauthenticationChallenge(current.token, 'google', secondChallenge.state);
    const { proof } = await store.issueReauthenticationProof(
      current.token,
      'google',
      'subject-current',
      secondConsumed.userId,
    );
    await expect(store.consumeReauthenticationProof(current.token, proof)).resolves.toBeUndefined();
    await expect(store.consumeReauthenticationProof(current.token, proof)).rejects.toMatchObject({
      code: 'reauthentication_invalid',
    });
  });

  it('expire les challenges et preuves de réauthentification', async () => {
    let now = new Date('2026-08-11T12:00:00.000Z');
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
      now: () => now,
    });
    const current = await store.issueSocialSession('apple', 'subject-current');
    const challenge = await store.issueReauthenticationChallenge(current.token, 'apple');
    now = new Date('2026-08-11T12:05:01.000Z');
    await expect(store.consumeReauthenticationChallenge(
      current.token,
      'apple',
      challenge.state,
    )).rejects.toMatchObject({ code: 'reauthentication_invalid' });
  });

  it('isole chaque installation preview et sa suppression', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'preview',
      authMode: 'development',
    });
    const first = await store.issueDevelopmentSession();
    const second = await store.issueDevelopmentSession();
    expect(second.user.id).not.toBe(first.user.id);

    await store.deleteDevelopmentAccount(first.token);

    await expect(store.verifySession(first.token)).resolves.toBeNull();
    await expect(store.verifySession(second.token)).resolves.toMatchObject({ user: second.user });
  });

  it('consomme un challenge social une seule fois', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
    });

    const challenge = await store.issueSocialChallenge('google');
    await expect(store.consumeSocialChallenge('google', challenge.state)).resolves.toMatchObject({
      nonce: challenge.nonce,
    });
    await expect(store.consumeSocialChallenge('google', challenge.state)).rejects.toMatchObject({
      code: 'social_challenge_invalid',
    });
  });

  it('réutilise uniquement la même identité provider/sub', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
    });

    const first = await store.issueSocialSession('google', 'subject-a');
    const same = await store.issueSocialSession('google', 'subject-a');
    const otherProvider = await store.issueSocialSession('apple', 'subject-a');

    expect(same.user.id).toBe(first.user.id);
    expect(same.user.displayName).toBe('Compte SCIO');
    expect(otherProvider.user.id).not.toBe(first.user.id);
    await expect(store.verifySession(first.token)).resolves.toMatchObject({
      user: { id: first.user.id, provider: 'google' },
    });
  });

  it('refuse la suppression development pour une identité sociale sans la supprimer', async () => {
    const store = createScioAuthStore({
      dataDirectory: await temporaryDirectory(),
      environment: 'test',
      deploymentEnvironment: 'production',
      authMode: 'social',
    });
    const social = await store.issueSocialSession('google', 'subject-protected');

    await expect(store.deleteDevelopmentAccount(social.token)).rejects.toMatchObject({
      code: 'session_invalid',
    });
    await expect(store.verifySession(social.token)).resolves.toMatchObject({ user: social.user });
  });
});
