import { AuthStoreError } from '@/lib/scio-auth-store';
import { errorResponse, noStoreJson, scioAuthStoreFromEnvironment } from '@/lib/scio-auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(): Promise<Response> {
  try {
    const session = await scioAuthStoreFromEnvironment().issueDevelopmentSession();
    return noStoreJson(session, { status: 201 });
  } catch (error) {
    if (error instanceof AuthStoreError && error.code === 'development_auth_forbidden') {
      return errorResponse(403, error.code);
    }
    if (error instanceof AuthStoreError && error.code === 'development_capacity_reached') {
      return errorResponse(429, error.code);
    }
    return errorResponse(503, 'auth_unavailable');
  }
}
