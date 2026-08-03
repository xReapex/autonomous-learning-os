"use client";

// La chrome du bureau : menubar avec le wordmark BizOS × Learning, rail de
// navigation, et la page au centre.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useStudy } from "./study-context";
import { WallpaperLayer } from "./wallpaper-layer";

const NAVIGATION = [
  { href: "/", label: "Aujourd'hui", index: "01" },
  { href: "/learning", label: "Cours", index: "02" },
  { href: "/exercises", label: "Exercices", index: "03" },
  { href: "/reviews", label: "Révisions", index: "04" },
  { href: "/settings", label: "Réglages", index: "05" },
];

export function LearningShell({ subject, children }: { subject: string; children: ReactNode }) {
  const pathname = usePathname();
  const { apiState, aiLabel } = useStudy();

  const statusLabel = apiState === "ok" ? "Espace prêt" : apiState === "checking" ? "Vérification" : "Hors ligne";

  return (
    <>
      <WallpaperLayer />
      <div className="bx-shell">
        <header className="bx-menubar">
          <Link href="/" className="bx-wordmark" aria-label="BizOS × Learning, accueil">
            BizOS <span className="bx-cross">×</span> Learning
            <span className="bx-subject">{subject}</span>
          </Link>
          <div className="bx-menubar-right">
            <span className="bx-status" data-state={apiState === "ok" ? "ok" : apiState === "down" ? "down" : "checking"}>
              <span aria-hidden="true" />
              {statusLabel}
            </span>
            <span>{aiLabel}</span>
          </div>
        </header>

        <div className="bx-frame">
          <aside className="bx-sidebar" aria-label="Navigation principale">
            <p className="bx-nav-heading">Ton espace</p>
            <nav className="bx-nav">
              {NAVIGATION.map((item) => {
                const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                return (
                  <Link key={item.href} href={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
                    <span>{item.index}</span>
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <div className="bx-nav-note">
              <strong>Rappel → capsule → pratique → bilan.</strong>
              <span>Le temps change les volumes, jamais la boucle.</span>
            </div>
          </aside>

          <div className="bx-page">{children}</div>
        </div>
      </div>
    </>
  );
}
