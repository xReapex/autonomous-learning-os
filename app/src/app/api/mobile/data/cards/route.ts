import { mobileDataHandlersFromEnvironment } from '@/lib/scio-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().getCards(request);
}
