"use client";

import { useEffect, useState } from "react";

import { allLessons, curriculum, sourceAudit } from "@/lib/curriculum";
import { formatDate } from "@/lib/format";
import { WallpaperGallery } from "./wallpaper-gallery";
import { Win } from "./window";

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
      <div className="bx-page-head">
        <div>
          <p className="bx-overline">Réglages</p>
          <h1>Ton espace, ta stack.</h1>
        </div>
        <p className="bx-page-intro">
          Rien ici n&apos;est partagé. Le stockage, le mode IA et le bot Telegram sont les tiens, configurés
          dans <code>.env.local</code>.
        </p>
      </div>

      <div className="bx-split">
        <div className="bx-stack">
          <Win title="Apparence" right="Galerie de fonds">
            <WallpaperGallery />
          </Win>

          <Win title="Curriculum" right={formatDate(curriculum.generatedAt)}>
            <div>
              <div className="bx-stat-row"><span>Sujet</span><strong>{curriculum.subject}</strong></div>
              <div className="bx-stat-row"><span>Objectif</span><strong style={{ textAlign: "right", maxWidth: "60%" }}>{curriculum.goal}</strong></div>
              <div className="bx-stat-row"><span>Matières</span><strong>{curriculum.subjects.length}</strong></div>
              <div className="bx-stat-row"><span>Leçons</span><strong>{audit.total}</strong></div>
              <div className="bx-stat-row"><span>Institutions</span><strong>{audit.providers}</strong></div>
              <div className="bx-stat-row"><span>Plus ancienne vérification</span><strong>{formatDate(audit.oldestVerification)}</strong></div>
            </div>
            <p className="bx-muted">
              Pour regénérer : relance la deep research depuis le repo, puis
              <code> node scripts/validate-curriculum.mjs</code>.
            </p>
          </Win>

          <Win title="Sources" right={`${lessons.length} vérifiées`}>
            <ul className="bx-list">
              {lessons.map(({ subject, lesson }) => (
                <li key={lesson.id}>
                  <span>
                    <strong>{subject.icon} {lesson.source.provider}</strong> — {" "}
                    <a href={lesson.source.url} target="_blank" rel="noreferrer">{lesson.source.title}</a>
                    {" · "}{formatDate(lesson.source.verifiedAt)}
                  </span>
                </li>
              ))}
            </ul>
          </Win>
        </div>

        <div className="bx-stack">
          <Win title="Stockage">
            <div>
              <div className="bx-stat-row">
                <span>Pilote</span>
                <strong>{health?.storage?.driver === "postgres" ? "PostgreSQL" : "Fichier local"}</strong>
              </div>
              <div className="bx-stat-row">
                <span>État</span>
                <span className="bx-badge" data-tone={health?.storage?.ok ? "live" : "danger"}>
                  {health?.storage?.ok ? "Connecté" : "Indisponible"}
                </span>
              </div>
            </div>
            {health?.storage?.error ? <p className="bx-muted">{health.storage.error}</p> : null}
            <p className="bx-muted">
              En mode fichier, tout reste dans <code>.data/</code> sur cette machine. Pour synchroniser
              plusieurs appareils, lance <code>scripts/03-database.sh</code>.
            </p>
          </Win>

          <Win title="Correction IA">
            <div>
              <div className="bx-stat-row"><span>Mode</span><strong>{health?.ai?.label ?? "—"}</strong></div>
            </div>
            <p className="bx-muted">
              {health?.ai?.provider === "claude-code"
                ? "Aucune clé API n'est utilisée. L'app prépare le prompt de correction, tu le donnes à ton agent."
                : health?.ai?.provider === "cli"
                  ? "L'app appelle ta CLI locale. Ton authentification reste dans la CLI, rien n'est stocké ici."
                  : "L'app appelle l'API avec TA clé, lue dans .env.local. Ce dépôt n'en fournit aucune."}
            </p>
          </Win>

          <Win title="Brief Telegram">
            <div>
              <div className="bx-stat-row">
                <span>État</span>
                <span className="bx-badge" data-tone={health?.telegram?.enabled ? "live" : "neutral"}>
                  {health?.telegram?.enabled ? "Configuré" : "Désactivé"}
                </span>
              </div>
            </div>
            {health?.telegram?.enabled ? (
              <>
                <button type="button" className="bx-btn bx-btn-accent" onClick={sendTestBrief} disabled={telegramState === "sending"}>
                  {telegramState === "sending" ? "Envoi…" : "Envoyer le brief maintenant"}
                </button>
                {telegramState === "sent" ? <p className="bx-muted">Envoyé — vérifie ton Telegram.</p> : null}
                {telegramState === "failed" ? <p className="bx-muted">{telegramError}</p> : null}
              </>
            ) : (
              <p className="bx-muted">
                Pour l&apos;activer : crée ton bot chez @BotFather, puis lance
                <code> bash scripts/04-telegram.sh</code>. Le token reste dans ton <code>.env.local</code>.
              </p>
            )}
          </Win>

          <Win title="Confidentialité">
            <ul className="bx-list">
              <li><span>Aucune donnée d&apos;apprentissage ne quitte ta machine en mode fichier.</span></li>
              <li><span>Aucune clé de tiers n&apos;est embarquée dans ce dépôt.</span></li>
              <li><span>Les seuls appels sortants sont ceux que tu configures : IA, base, Telegram.</span></li>
              <li><span>Le lecteur utilise youtube-nocookie.com.</span></li>
            </ul>
          </Win>
        </div>
      </div>
    </>
  );
}
