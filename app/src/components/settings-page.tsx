"use client";

import { useEffect, useState } from "react";

import { allLessons, sourceAudit } from "@/lib/curriculum";
import { CurriculumEditor } from "./curriculum-editor";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";

import { Card, Status } from "./window";

type Health = {
  ok?: boolean;
  storage?: { driver?: string; ok?: boolean; error?: string | null };
  ai?: { provider?: string; label?: string };
  telegram?: { enabled?: boolean };
};

export function SettingsPage() {
  const { curriculum, revision, source } = useCurriculum();
  const { locale, setLocale, t, formatDate } = useLocale();
  const [health, setHealth] = useState<Health | null>(null);
  const [telegramState, setTelegramState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [telegramError, setTelegramError] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, [revision]);

  async function sendTestBrief() {
    setTelegramState("sending");
    setTelegramError("");
    try {
      const response = await fetch("/api/telegram", { method: "POST" });
      const body = await response.json() as { error?: string };
      if (response.ok) {
        setTelegramState("sent");
      } else {
        setTelegramState("failed");
        setTelegramError(body.error ?? t("common.retry"));
      }
    } catch {
      setTelegramState("failed");
      setTelegramError(t("exercises.serverError"));
    }
  }

  const audit = sourceAudit(curriculum);
  const lessons = allLessons(curriculum);
  const localizedLessons = lessons.filter(({ lesson }) =>
    lesson.source.language.toLowerCase().split(/[-_]/, 1)[0] === locale,
  );

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={t("settings.studio")} right={source === "override" ? t("settings.custom") : t("settings.delivered")}>
          <CurriculumEditor />
        </Card>


        <Card title={t("settings.sources")} right={t("settings.verified", { count: localizedLessons.length })}>
          {localizedLessons.length === 0 ? <div className="bx-note" role="status">{t("settings.noVideoForLanguage")}</div> : null}
          {localizedLessons.map(({ subject, lesson }) => (
            <a
              key={lesson.id}
              className="bx-row"
              href={lesson.source.url}
              target="_blank"
              rel="noreferrer"
            >
              <span className="bx-row-icon" aria-hidden="true">{subject.icon}</span>
              <span className="bx-row-body">
                <span className="bx-row-title">{lesson.source.title}</span>
                <span className="bx-row-meta">
                  {lesson.source.provider} · {t("settings.verifiedOn", { date: formatDate(lesson.source.verifiedAt) })}
                </span>
              </span>
              <span className="bx-row-open">{t("common.open")}</span>
            </a>
          ))}
        </Card>
      </div>

      <div className="bx-col">
        <Card title={t("settings.application")} right={health?.ok ? t("settings.ready") : t("settings.check")}>
          <details className="bx-settings-section" open>
            <summary><span>{t("locale.label")}</span><strong>{locale === "fr" ? t("locale.french") : t("locale.english")}</strong></summary>
            <div className="bx-settings-section-body">
              <label className="bx-field" htmlFor="interface-locale">
                <span className="bx-label">{t("locale.label")}</span>
                <select id="interface-locale" className="bx-select" value={locale} onChange={(event) => setLocale(event.target.value as "fr" | "en")}>
                  <option value="fr">{t("locale.french")}</option>
                  <option value="en">{t("locale.english")}</option>
                </select>
                <small className="bx-muted">{t("locale.detectedCopy")}</small>
              </label>
            </div>
          </details>

          <details className="bx-settings-section">
            <summary><span>{t("settings.curriculum")}</span><strong>{t("common.subjects", { count: curriculum.subjects.length })} · {t("common.lessons", { count: audit.total })}</strong></summary>
            <div className="bx-settings-section-body">
              <div className="bx-stat"><span>{t("settings.subject")}</span><strong>{curriculum.subject}</strong></div>
              <div className="bx-stat"><span>{t("settings.institutions")}</span><strong>{audit.providers}</strong></div>
              <div className="bx-stat"><span>{t("settings.oldestCheck")}</span><strong>{formatDate(audit.oldestVerification)}</strong></div>
              <p className="bx-muted">{curriculum.goal}</p>
            </div>
          </details>

          <details className="bx-settings-section">
            <summary><span>{t("settings.storage")}</span><Status on={health?.storage?.ok ?? false}>{health?.storage?.driver === "postgres" ? "PostgreSQL" : t("settings.localFile")}</Status></summary>
            <div className="bx-settings-section-body">
              {health?.storage?.error ? <p className="bx-muted">{health.storage.error}</p> : null}
              <p className="bx-muted">{t("settings.storageCopy")}</p>
            </div>
          </details>

          <details className="bx-settings-section">
            <summary><span>{t("settings.ai")}</span><Status on>{health?.ai?.provider === "claude-code" ? t("settings.aiAgentLabel") : health?.ai?.provider === "cli" ? t("settings.aiCliLabel") : health?.ai?.provider === "api" ? t("settings.aiApiLabel") : "—"}</Status></summary>
            <div className="bx-settings-section-body">
              <p className="bx-muted">
                {health?.ai?.provider === "claude-code"
                  ? t("settings.aiAgent")
                  : health?.ai?.provider === "cli"
                    ? t("settings.aiCli")
                    : t("settings.aiApi")}
              </p>
            </div>
          </details>

          <details className="bx-settings-section">
            <summary><span>{t("settings.telegram")}</span><Status on={health?.telegram?.enabled ?? false}>{health?.telegram?.enabled ? t("settings.configured") : t("settings.disabled")}</Status></summary>
            <div className="bx-settings-section-body">
              {health?.telegram?.enabled ? (
                <>
                  <button type="button" className="bx-btn" onClick={sendTestBrief} disabled={telegramState === "sending"}>
                    {telegramState === "sending" ? t("settings.sending") : t("settings.sendBrief")}
                  </button>
                  {telegramState === "sent" ? <p className="bx-muted">{t("settings.briefSent")}</p> : null}
                  {telegramState === "failed" ? <p className="bx-muted">{telegramError}</p> : null}
                </>
              ) : <p className="bx-muted">{t("settings.briefDisabled")}</p>}
            </div>
          </details>

          <details className="bx-settings-section">
            <summary><span>{t("settings.privacy")}</span><strong>{t("settings.noAds")}</strong></summary>
            <div className="bx-settings-section-body">
              <ul className="bx-list">
                <li><span>{t("settings.noTracker")}</span></li>
                <li><span>{t("settings.noKeys")}</span></li>
                <li><span>{t("settings.outbound")}</span></li>
                <li><span>{t("settings.youtube")}</span></li>
              </ul>
            </div>
          </details>
        </Card>
      </div>
    </>
  );
}
