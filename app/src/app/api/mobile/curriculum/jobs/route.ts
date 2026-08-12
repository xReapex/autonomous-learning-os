import { mobileGenerationJobHandlersFromEnvironment } from '@/lib/scio-generation-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: Request): Promise<Response> {
  return mobileGenerationJobHandlersFromEnvironment().create(request);
}

export async function GET(request: Request): Promise<Response> {
  return mobileGenerationJobHandlersFromEnvironment().resolve(request);
}
