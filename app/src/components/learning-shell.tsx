"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import type { LocaleKey } from "@/lib/i18n";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { RewardSummary } from "./rewards-context";

type IconName = "home" | "learn" | "practice" | "review" | "settings";

const NAVIGATION: { href: string; label: LocaleKey; icon: IconName }[] = [
  { href: "/", label: "nav.home", icon: "home" },
  { href: "/learning", label: "nav.course", icon: "learn" },
  { href: "/exercises", label: "nav.exercises", icon: "practice" },
  { href: "/reviews", label: "nav.reviews", icon: "review" },
  { href: "/settings", label: "nav.settings", icon: "settings" },
];

function NavIcon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    home: <><path d="M3.5 11.2 12 4l8.5 7.2" /><path d="M5.5 10v10h13V10M9.5 20v-6h5v6" /></>,
    learn: <><path d="M4 5.5A3.5 3.5 0 0 1 7.5 4H12v16H7.5A3.5 3.5 0 0 0 4 21.5Z" /><path d="M20 5.5A3.5 3.5 0 0 0 16.5 4H12v16h4.5a3.5 3.5 0 0 1 3.5 1.5Z" /></>,
    practice: <><path d="m4 20 4.2-1 10.9-10.9a2.2 2.2 0 0 0-3.2-3.2L5 15.8Z" /><path d="m14.5 6.5 3 3M4 20h6" /></>,
    review: <><path d="M20 7h-9a6 6 0 0 0-6 6v1" /><path d="m8 10-3 4-3-4M4 17h9a6 6 0 0 0 6-6v-1" /><path d="m16 14 3-4 3 4" /></>,
    settings: <><path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M6 14v6" /></>,
  };
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Navigation({ pathname, className }: { pathname: string; className: string }) {
  const { t } = useLocale();
  return (
    <nav className={className} aria-label={t("nav.label")}>
      {NAVIGATION.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link key={item.href} href={item.href} className={active ? "is-active" : undefined} aria-current={active ? "page" : undefined}>
            <NavIcon name={item.icon} />
            <span>{t(item.label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function LearningShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { curriculum } = useCurriculum();
  const { t } = useLocale();

  return (
    <div className="bx-app-shell">
      <aside className="bx-sidebar">
        <Link href="/" className="bx-brand" aria-label={`${t("shell.homeLabel")} — ${curriculum.subject}`}>
          <span className="bx-brand-mark" aria-hidden="true"><Image src="/scio-mark.svg" alt="" width={28} height={28} priority /></span>
          <span><strong>SCIO</strong><small>{t("shell.tagline")}</small></span>
        </Link>
        <Navigation pathname={pathname} className="bx-sidebar-nav" />
        <RewardSummary compact />
        <div className="bx-sidebar-foot">
          <span>{t("shell.activeCurriculum")}</span>
          <strong>{curriculum.subject}</strong>
        </div>
      </aside>

      <div className="bx-app-frame">
        <header className="bx-app-header">
          <Link href="/" className="bx-mobile-brand" aria-label={t("shell.homeLabel")}>
            <span className="bx-brand-mark" aria-hidden="true"><Image src="/scio-mark.svg" alt="" width={28} height={28} priority /></span>
            <strong>SCIO</strong>
          </Link>
          <RewardSummary compact />
        </header>
        <main id="main-content" className="bx-workspace">{children}</main>
      </div>

      <Navigation pathname={pathname} className="bx-mobile-nav" />
    </div>
  );
}
