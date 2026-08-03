"use client";

// La chrome V9 : le wallpaper occupe tout l'écran, le wordmark est centré
// au-dessus de l'espace de travail — hors des cartes, jamais répété dedans —
// et les destinations vivent dans une barre basse persistante.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useStudy } from "./study-context";
import { WallpaperLayer } from "./wallpaper-layer";

const NAVIGATION = [
  { href: "/", label: "Aujourd'hui" },
  { href: "/learning", label: "Cours" },
  { href: "/exercises", label: "Exercices" },
  { href: "/reviews", label: "Révisions" },
  { href: "/settings", label: "Réglages" },
];

export function LearningShell({ subject, children }: { subject: string; children: ReactNode }) {
  const pathname = usePathname();
  const { apiState, aiLabel } = useStudy();

  // Le statut s'écrit en toutes lettres : aucune information n'est portée par
  // la seule couleur.
  const statusLabel = apiState === "ok" ? "Espace prêt" : apiState === "checking" ? "Vérification" : "Hors ligne";

  return (
    <>
      <WallpaperLayer />
      <div className="bx-shell">
        <Link href="/" className="bx-wordmark" aria-label={`BizOS Learning, accueil — ${subject}`}>
          BizOS<sup>Learning</sup>
        </Link>
        <p className="bx-subtitle">{subject}</p>

        <div className="bx-workspace">{children}</div>

        <nav className="bx-dock" aria-label="Navigation principale">
          {NAVIGATION.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={active ? "is-active" : undefined}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
          <span className="bx-dock-state">{statusLabel} · {aiLabel}</span>
        </nav>
      </div>
    </>
  );
}
