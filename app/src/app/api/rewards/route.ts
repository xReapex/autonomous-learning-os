import { NextResponse } from "next/server";

import { getStorage, type Storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

export function createRewardsHandlers(storage: () => Storage = getStorage) {
  return {
    async GET() {
      return NextResponse.json(await storage().getRewardState(), {
        headers: { "cache-control": "no-store" },
      });
    },
  };
}

export const { GET } = createRewardsHandlers();
