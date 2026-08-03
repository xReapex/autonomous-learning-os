import type { Metadata, Viewport } from "next";
import { Inria_Serif, Lexend } from "next/font/google";

import "./globals.css";
import { LearningShell } from "@/components/learning-shell";
import { StudyProvider } from "@/components/study-context";
import { WallpaperProvider } from "@/components/wallpaper-context";
import { DEFAULT_WALLPAPER_ID } from "@/lib/wallpapers";

// Les deux voix de la V9 : Inria Serif porte le produit, Lexend les microcopies
// en capitales espacées (libellés, métadonnées, wordmark suffix).
// next/font les télécharge au build puis les auto-héberge — aucun appel à
// Google au runtime, et Georgia reste un repli très proche si le build se fait
// hors ligne.
const inria = Inria_Serif({
  subsets: ["latin"],
  weight: ["400", "700"],
  style: ["normal", "italic"],
  variable: "--font-inria",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

const lexend = Lexend({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-lexend",
  display: "swap",
  fallback: ["Helvetica Neue", "Arial", "sans-serif"],
});

const SUBJECT = process.env.NEXT_PUBLIC_LEARNING_SUBJECT || "Apprentissage";
const DEFAULT_MINUTES = Number(process.env.NEXT_PUBLIC_DEFAULT_SESSION_MINUTES || 30);
const DEFAULT_WALLPAPER = process.env.NEXT_PUBLIC_DEFAULT_WALLPAPER || DEFAULT_WALLPAPER_ID;

export const metadata: Metadata = {
  title: `BizOS × Learning — ${SUBJECT}`,
  description: "Rappel actif, capsules courtes issues de sources vérifiées, pratique de transfert et révision espacée.",
  // L'app est personnelle : rien à indexer, personne d'autre à qui la montrer.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${inria.variable} ${lexend.variable}`}>
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
