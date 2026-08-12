import { mobileDataHandlersFromEnvironment } from '@/lib/scio-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Params = { params: Promise<{ cardId: string }> };

export async function PATCH(request: Request, { params }: Params): Promise<Response> {
  const { cardId } = await params;
  return mobileDataHandlersFromEnvironment().patchCard(request, cardId);
}
