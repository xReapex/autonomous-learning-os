import { mobileGenerationJobHandlersFromEnvironment } from '@/lib/scio-generation-jobs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Context = { params: Promise<{ jobId: string }> };

export async function GET(request: Request, context: Context): Promise<Response> {
  return mobileGenerationJobHandlersFromEnvironment().get(request, (await context.params).jobId);
}

export async function DELETE(request: Request, context: Context): Promise<Response> {
  return mobileGenerationJobHandlersFromEnvironment().cancel(request, (await context.params).jobId);
}
