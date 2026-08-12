import { mobileDataHandlersFromEnvironment } from '@/lib/scio-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().postNote(request);
}
