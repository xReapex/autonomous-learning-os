import { mobileGenerationJobHandlersFromEnvironment } from '@/lib/scio-generation-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ jobId: string }> };

export async function POST(request: Request, context: Context): Promise<Response> {
  return mobileGenerationJobHandlersFromEnvironment().acknowledge(request, (await context.params).jobId);
}