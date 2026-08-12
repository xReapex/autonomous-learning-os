import { NextResponse } from "next/server";

import { lessonById, normalizeCurriculumDocument } from "@/lib/curriculum";
import { loadActiveCurriculum } from "@/lib/curriculum-store";
import { normalizeLessonProgress } from "@/lib/lesson-progress";
import { getStorage } from "@/lib/storage";
import type { Storage } from "@/lib/storage";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ lessonId: string }> };

type ProgressDependencies = {
  storage: () => Storage;
  loadCurriculum: typeof loadActiveCurriculum;
  now: () => Date;
};

export function createProgressHandlers(overrides: Partial<ProgressDependencies> = {}) {
  const dependencies: ProgressDependencies = {
    storage: getStorage,
    loadCurriculum: loadActiveCurriculum,
    now: () => new Date(),
    ...overrides,
  };

  return {
    async GET(_request: Request, { params }: Params) {
      const { lessonId } = await params;
      const curriculum = normalizeCurriculumDocument((await dependencies.loadCurriculum()).document);
      if (!lessonById(lessonId, curriculum)) {
        return NextResponse.json({ error: "Leçon inconnue dans ce curriculum." }, { status: 404 });
      }

      const progress = await dependencies.storage().getProgress(lessonId);
      if (!progress) return NextResponse.json(null, { status: 404 });
      return NextResponse.json(progress);
    },

    async PUT(request: Request, { params }: Params) {
      const { lessonId } = await params;
      const curriculum = normalizeCurriculumDocument((await dependencies.loadCurriculum()).document);
      const entry = lessonById(lessonId, curriculum);
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
      const storage = dependencies.storage();
      const saved = await storage.saveProgress(progress);
      // L'eventId déterministe rend aussi une reprise sûre après une coupure
      // entre la sauvegarde de progression et l'attribution : seul le premier
      // appel gagne, les suivants relisent un grant idempotent à zéro.
      const reward = saved.completed
        ? await storage.awardReward({
            eventId: `lesson:${lessonId}:completed`,
            kind: "lesson_completed",
            occurredAt: dependencies.now().toISOString(),
            subjectId: entry.subject.id,
            itemId: lessonId,
          })
        : null;
      return NextResponse.json({ ...saved, reward });
    },
  };
}

export const { GET, PUT } = createProgressHandlers();
