import { NextResponse } from "next/server";

import { lessonById } from "@/lib/curriculum";
import { normalizeLessonProgress } from "@/lib/lesson-progress";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lessonId: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { lessonId } = await params;
  if (!lessonById(lessonId)) {
    return NextResponse.json({ error: "Leçon inconnue dans ce curriculum." }, { status: 404 });
  }

  const progress = await getStorage().getProgress(lessonId);
  if (!progress) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(progress);
}

export async function PUT(request: Request, { params }: Params) {
  const { lessonId } = await params;
  const entry = lessonById(lessonId);
  if (!entry) {
    return NextResponse.json({ error: "Leçon inconnue dans ce curriculum." }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  // L'URL de la source vient du curriculum, jamais du client : une progression
  // ne doit pas pouvoir pointer ailleurs que sur la leçon qu'elle nomme.
  const progress = normalizeLessonProgress(body, lessonId, entry.lesson.source.url);
  const saved = await getStorage().saveProgress(progress);
  return NextResponse.json(saved);
}
