import type { SocialProvider, ServerAuthSession } from './auth-api';

type SocialChallenge = { state: string; nonce: string; expiresAt: string };
type NativeIdentityResult = { type: 'cancelled' } | { type: 'success'; idToken: string };

type SocialAuthApi = {
  createSocialChallenge: (provider: SocialProvider) => Promise<SocialChallenge>;
  exchangeSocialIdentity: (
    provider: SocialProvider,
    state: string,
    idToken: string,
  ) => Promise<ServerAuthSession>;
};

type SocialSignInDependencies = {
  api: SocialAuthApi;
  requestIdentity: (input: { provider: SocialProvider; nonce: string }) => Promise<NativeIdentityResult>;
};

type SocialReauthenticationApi = {
  createReauthenticationChallenge: (provider: SocialProvider) => Promise<SocialChallenge>;
  exchangeReauthenticationIdentity: (
    provider: SocialProvider,
    state: string,
    idToken: string,
  ) => Promise<string>;
};

export class SocialSignInError extends Error {
  constructor(code: string) {
    super(code);
    this.name = 'SocialSignInError';
  }
}

function validIdToken(value: string): boolean {
  return value.length >= 20 && value.length <= 16_384 && value.split('.').length === 3;
}

export function createSocialSignIn({ api, requestIdentity }: SocialSignInDependencies) {
  let inProgress = false;

  return async function signIn(provider: SocialProvider): Promise<
    { type: 'cancelled' } | { type: 'success'; session: ServerAuthSession }
  > {
    if (inProgress) throw new SocialSignInError('social_auth_in_progress');
    inProgress = true;
    try {
      const challenge = await api.createSocialChallenge(provider);
      const identity = await requestIdentity({ provider, nonce: challenge.nonce });
      if (identity.type === 'cancelled') return identity;
      if (!validIdToken(identity.idToken)) throw new SocialSignInError('social_identity_invalid');
      const session = await api.exchangeSocialIdentity(provider, challenge.state, identity.idToken);
      return { type: 'success', session };
    } finally {
      inProgress = false;
    }
  };
}

export function createSocialReauthentication({
  api,
  requestIdentity,
}: {
  api: SocialReauthenticationApi;
  requestIdentity: SocialSignInDependencies['requestIdentity'];
}) {
  let inProgress = false;
  return async function reauthenticate(provider: SocialProvider): Promise<
    { type: 'cancelled' } | { type: 'success'; proof: string }
  > {
    if (inProgress) throw new SocialSignInError('social_auth_in_progress');
    inProgress = true;
    try {
      const challenge = await api.createReauthenticationChallenge(provider);
      const identity = await requestIdentity({ provider, nonce: challenge.nonce });
      if (identity.type === 'cancelled') return identity;
      if (!validIdToken(identity.idToken)) throw new SocialSignInError('social_identity_invalid');
      const proof = await api.exchangeReauthenticationIdentity(provider, challenge.state, identity.idToken);
      return { type: 'success', proof };
    } finally {
      inProgress = false;
    }
  };
}
