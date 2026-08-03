import type { Metadata, Viewport } from "next";

import "./globals.css";
import { LearningShell } from "@/components/learning-shell";
import { StudyProvider } from "@/components/study-context";
import { WallpaperProvider } from "@/components/wallpaper-context";
import { DEFAULT_WALLPAPER_ID } from "@/lib/wallpapers";

const SUBJECT = process.env.NEXT_PUBLIC_LEARNING_SUBJECT || "Apprentissage";
const DEFAULT_MINUTES = Number(process.env.NEXT_PUBLIC_DEFAULT_SESSION_MINUTES || 30);
const DEFAULT_WALLPAPER = process.env.NEXT_PUBLIC_DEFAULT_WALLPAPER || DEFAULT_WALLPAPER_ID;

export const metadata: Metadata = {
  title: `BizOS × Learning — ${SUBJECT}`,
  description: "Rappel actif, capsules courtes issues de sources vérifiées, pratique de transfert et révision espacée.",
  // L'app est personnelle : rien à indexer, et personne d'autre à qui la montrer.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#ece5d6",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <WallpaperProvider defaultId={DEFAULT_WALLPAPER}>
          <StudyProvider defaultMinutes={DEFAULT_MINUTES}>
            <LearningShell subject={SUBJECT}>{children}</LearningShell>
          </StudyProvider>
        </WallpaperProvider>
      </body>
    </html>
  );
}
