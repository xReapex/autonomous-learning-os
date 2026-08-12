import { AuthStoreError } from '@/lib/scio-auth-store';
import { bearerToken, errorResponse, noStoreJson, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';
import { boundedJson, socialAudienceFromEnvironment, socialExchangeBody } from '@/lib/social-auth-contract';
import { verifySocialIdentityViaWorker } from '@/lib/social-identity-worker-client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');
  try {
    const body = socialExchangeBody(await boundedJson(request));
    const audience = socialAudienceFromEnvironment(body.provider);
    if (!audience) return errorResponse(503, 'social_auth_unavailable');
    const auth = scioAuthStoreFromEnvironment();
    const challenge = await auth.consumeReauthenticationChallenge(token, body.provider, body.state);
    const identity = await verifySocialIdentityViaWorker({
      provider: body.provider,
      idToken: body.idToken,
      expectedNonce: challenge.nonce,
      audience,
    });
    return noStoreJson(
      await auth.issueReauthenticationProof(token, body.provider, identity.subject, challenge.userId),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === 'reauthentication_invalid') {
      return errorResponse(401, error.code);
    }
    if (error instanceof Error && error.message === 'request_too_large') return errorResponse(413, error.message);
    if (error instanceof Error && error.message === 'request_invalid') return errorResponse(400, error.message);
    if (error instanceof Error && error.message === 'social_identity_invalid') {
      return errorResponse(401, 'reauthentication_invalid');
    }
    return errorResponse(503, 'social_auth_unavailable');
  }
}
