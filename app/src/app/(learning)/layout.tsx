import type { Metadata } from "next";

import { CurriculumProvider } from "@/components/curriculum-context";
import { LearningShell } from "@/components/learning-shell";
import { LocaleProvider } from "@/components/locale-context";
import { RewardsProvider } from "@/components/rewards-context";
import { StudyProvider } from "@/components/study-context";
import { loadActiveCurriculum } from "@/lib/curriculum-store";

const DEFAULT_MINUTES = Number(process.env.NEXT_PUBLIC_DEFAULT_SESSION_MINUTES || 30);

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const active = await loadActiveCurriculum();
  return {
    title: `SCIO — ${active.document.subject}`,
    description: active.document.goal,
    robots: { index: false, follow: false },
  };
}

export default async function LearningLayout({ children }: { children: React.ReactNode }) {
  const active = await loadActiveCurriculum();
  return (
    <LocaleProvider>
      <CurriculumProvider initial={active}>
        <StudyProvider defaultMinutes={active.document.sessionMinutes ?? DEFAULT_MINUTES}>
          <RewardsProvider>
            <LearningShell>{children}</LearningShell>
          </RewardsProvider>
        </StudyProvider>
      </CurriculumProvider>
    </LocaleProvider>
  );
}
