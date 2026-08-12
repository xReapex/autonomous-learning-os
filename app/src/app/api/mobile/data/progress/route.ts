import { mobileDataHandlersFromEnvironment } from '@/lib/scio-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().getProgress(request);
}

export async function PATCH(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().patchProgress(request);
}
