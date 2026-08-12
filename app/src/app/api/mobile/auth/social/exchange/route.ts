import { AuthStoreError } from '@/lib/scio-auth-store';
import { errorResponse, noStoreJson, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';
import { boundedJson, socialAudienceFromEnvironment, socialExchangeBody } from '@/lib/social-auth-contract';
import { verifySocialIdentityViaWorker } from '@/lib/social-identity-worker-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  try {
    const body = socialExchangeBody(await boundedJson(request));
    const audience = socialAudienceFromEnvironment(body.provider);
    if (!audience) return errorResponse(503, 'social_auth_unavailable');
    const auth = scioAuthStoreFromEnvironment();
    const challenge = await auth.consumeSocialChallenge(body.provider, body.state);
    const identity = await verifySocialIdentityViaWorker({
      provider: body.provider,
      idToken: body.idToken,
      expectedNonce: challenge.nonce,
      audience,
    });
    return noStoreJson(await auth.issueSocialSession(
      body.provider,
      identity.subject,
    ), { status: 201 });
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === 'social_auth_forbidden') {
      return errorResponse(403, error.code);
    }
    if (error instanceof AuthStoreError && error.code === 'social_challenge_invalid') {
      return errorResponse(401, error.code);
    }
    if (error instanceof Error && error.message === 'request_too_large') {
      return errorResponse(413, error.message);
    }
    if (error instanceof Error && error.message === 'request_invalid') {
      return errorResponse(400, error.message);
    }
    if (error instanceof Error && error.message === 'social_identity_invalid') {
      return errorResponse(401, error.message);
    }
    return errorResponse(503, 'social_auth_unavailable');
  }
}
