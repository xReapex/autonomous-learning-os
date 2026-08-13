import { mobileDataHandlersFromEnvironment } from '@/lib/scio-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().getCurriculum(request);
}

export async function PUT(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().putCurriculum(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return mobileDataHandlersFromEnvironment().deleteCurriculum(request);
}
