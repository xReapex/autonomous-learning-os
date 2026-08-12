import { bearerToken, errorResponse, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';
import { AuthStoreError } from '@/lib/scio-auth-store';
import { scioUserDataStoreFromEnvironment } from '@/lib/scio-data';
import { scioGenerationJobStoreFromEnvironment } from '@/lib/scio-generation-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function DELETE(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');

  try {
    const auth = scioAuthStoreFromEnvironment();
    const session = await auth.verifySession(token);
    if (!session) return errorResponse(401, 'session_unauthorized');
    if (session.user.provider !== 'development') {
      const proof = request.headers.get('x-scio-reauthentication')?.trim();
      if (!proof) return errorResponse(401, 'reauthentication_required');
      try {
        await auth.consumeReauthenticationProof(token, proof);
      } catch (error) {
        if (error instanceof AuthStoreError && error.code === 'reauthentication_invalid') {
          return errorResponse(401, 'reauthentication_required');
        }
        throw error;
      }
    }
    await scioGenerationJobStoreFromEnvironment().deleteUserJobs(session.user.id);
    await scioUserDataStoreFromEnvironment().deleteUserData(session.user.id);
    await auth.deleteAccount(token);
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === 'session_invalid') {
      return errorResponse(401, 'session_unauthorized');
    }
    return errorResponse(503, 'auth_unavailable');
  }
}
