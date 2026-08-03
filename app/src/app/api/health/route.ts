import { NextResponse } from "next/server";

import { curriculum, sourceAudit } from "@/lib/curriculum";
import { currentProvider, providerLabel } from "@/lib/ai";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * L'état réel de l'espace : le stockage répond-il, quel mode IA, quel
 * curriculum. Utilisé par le bandeau de connexion et par 05-verify.sh.
 */
export async function GET() {
  const storage = getStorage();
  const audit = sourceAudit();

  let storageOk = false;
  let storageError: string | null = null;
  try {
    storageOk = await storage.ping();
  } catch (error) {
    storageError = (error as Error).message;
  }

  const provider = currentProvider();

  return NextResponse.json({
    ok: storageOk,
    storage: { driver: storage.driver, ok: storageOk, error: storageError },
    ai: { provider, label: providerLabel(provider) },
    telegram: { enabled: process.env.TELEGRAM_ENABLED === "true" },
    curriculum: {
      subject: curriculum.subject,
      goal: curriculum.goal,
      generatedAt: curriculum.generatedAt,
      subjects: curriculum.subjects.length,
      lessons: audit.total,
      providers: audit.providers,
      oldestVerification: audit.oldestVerification,
    },
  });
}
