"use client";

import { useEffect, useState } from "react";

import { allLessons, curriculum, sourceAudit } from "@/lib/curriculum";
import { formatDate } from "@/lib/format";
import { WallpaperGallery } from "./wallpaper-gallery";
import { Card, Status } from "./window";

type Health = {
  ok?: boolean;
  storage?: { driver?: string; ok?: boolean; error?: string | null };
  ai?: { provider?: string; label?: string };
  telegram?: { enabled?: boolean };
};

export function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [telegramState, setTelegramState] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const [telegramError, setTelegramError] = useState("");

  useEffect(() => {
    fetch("/api/health", { cache: "no-store" })
      .then((response) => response.json())
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);

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
        setTelegramError(body.error ?? "Envoi refusé.");
      }
    } catch {
      setTelegramState("failed");
      setTelegramError("Le serveur n'a pas répondu.");
    }
  }

  const audit = sourceAudit();
  const lessons = allLessons();

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title="Apparence" right="Galerie de fonds">
          <div className="bx-page-head">
            <p className="bx-overline">Réglages</p>
            <h1>Ton espace, ta stack.</h1>
          </div>
          <WallpaperGallery />
        </Card>

        <Card title="Sources" right={`${lessons.length} vérifiées`}>
          {lessons.map(({ subject, lesson }) => (
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
                  {lesson.source.provider} · vérifiée le {formatDate(lesson.source.verifiedAt)}
                </span>
              </span>
              <span className="bx-row-open">Ouvrir →</span>
            </a>
          ))}
        </Card>
      </div>

      <div className="bx-col">
        <Card title="Curriculum" right={formatDate(curriculum.generatedAt)}>
          <div>
            <div className="bx-stat"><span>Sujet</span><strong>{curriculum.subject}</strong></div>
            <div className="bx-stat"><span>Matières</span><strong>{curriculum.subjects.length}</strong></div>
            <div className="bx-stat"><span>Leçons</span><strong>{audit.total}</strong></div>
            <div className="bx-stat"><span>Institutions</span><strong>{audit.providers}</strong></div>
            <div className="bx-stat"><span>Plus ancienne vérif.</span><strong>{formatDate(audit.oldestVerification)}</strong></div>
          </div>
          <p className="bx-muted">{curriculum.goal}</p>
        </Card>

        <Card title="Stockage">
          <div className="bx-between">
            <span className="bx-muted">Pilote</span>
            <Status on={health?.storage?.ok ?? false}>
              {health?.storage?.driver === "postgres" ? "PostgreSQL" : "Fichier local"}
            </Status>
          </div>
          {health?.storage?.error ? <p className="bx-muted">{health.storage.error}</p> : null}
          <p className="bx-muted">
            En mode fichier, tout reste dans <code>.data/</code> sur cette machine. Pour synchroniser
            plusieurs appareils, lance <code>scripts/03-database.sh</code>.
          </p>
        </Card>

        <Card title="Correction IA">
          <div className="bx-between">
            <span className="bx-muted">Mode</span>
            <Status on>{health?.ai?.label ?? "—"}</Status>
          </div>
          <p className="bx-muted">
            {health?.ai?.provider === "claude-code"
              ? "Aucune clé API n'est utilisée. L'app prépare le prompt de correction, tu le donnes à ton agent."
              : health?.ai?.provider === "cli"
                ? "L'app appelle ta CLI locale. Ton authentification reste dans la CLI, rien n'est stocké ici."
                : "L'app appelle l'API avec TA clé, lue dans .env.local. Ce dépôt n'en fournit aucune."}
          </p>
        </Card>

        <Card title="Brief Telegram">
          <div className="bx-between">
            <span className="bx-muted">État</span>
            <Status on={health?.telegram?.enabled ?? false}>
              {health?.telegram?.enabled ? "Configuré" : "Désactivé"}
            </Status>
          </div>
          {health?.telegram?.enabled ? (
            <>
              <button type="button" className="bx-btn" onClick={sendTestBrief} disabled={telegramState === "sending"}>
                {telegramState === "sending" ? "Envoi…" : "Envoyer le brief"}
              </button>
              {telegramState === "sent" ? <p className="bx-muted">Envoyé — vérifie ton Telegram.</p> : null}
              {telegramState === "failed" ? <p className="bx-muted">{telegramError}</p> : null}
            </>
          ) : (
            <p className="bx-muted">
              Crée ton bot chez @BotFather, puis lance <code>bash scripts/04-telegram.sh</code>.
              Le token reste dans ton <code>.env.local</code>.
            </p>
          )}
        </Card>

        <Card title="Confidentialité">
          <ul className="bx-list">
            <li><span>Aucune donnée d&apos;apprentissage ne quitte ta machine en mode fichier.</span></li>
            <li><span>Aucune clé de tiers n&apos;est embarquée dans ce dépôt.</span></li>
            <li><span>Les seuls appels sortants sont ceux que tu configures.</span></li>
            <li><span>Le lecteur utilise youtube-nocookie.com.</span></li>
          </ul>
        </Card>
      </div>
    </>
  );
}
