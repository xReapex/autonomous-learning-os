import { bearerToken, errorResponse, noStoreJson, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');

  try {
    const identity = await scioAuthStoreFromEnvironment().verifySession(token);
    if (!identity) return errorResponse(401, 'session_unauthorized');
    return noStoreJson(identity);
  } catch {
    return errorResponse(503, 'auth_unavailable');
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const token = bearerToken(request);
  if (!token) return errorResponse(401, 'session_unauthorized');

  try {
    const store = scioAuthStoreFromEnvironment();
    if (!(await store.verifySession(token))) return errorResponse(401, 'session_unauthorized');
    await store.revokeSession(token);
    return new Response(null, {
      status: 204,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
      },
    });
  } catch {
    return errorResponse(503, 'auth_unavailable');
  }
}
