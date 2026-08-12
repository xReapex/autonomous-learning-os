import { AuthStoreError } from '@/lib/scio-auth-store';
import { bearerToken, errorResponse, noStoreJson, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';
import { parseSocialProvider, socialAudienceFromEnvironment } from '@/lib/social-auth-contract';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');
  const provider = parseSocialProvider(new URL(request.url).searchParams.get('provider'));
  if (!provider) return errorResponse(400, 'social_provider_invalid');
  if (!socialAudienceFromEnvironment(provider)) return errorResponse(503, 'social_auth_unavailable');
  try {
    return noStoreJson(
      await scioAuthStoreFromEnvironment().issueReauthenticationChallenge(token, provider),
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === 'reauthentication_invalid') {
      return errorResponse(401, error.code);
    }
    return errorResponse(503, 'social_auth_unavailable');
  }
}
