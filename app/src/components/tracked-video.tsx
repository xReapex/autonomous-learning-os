"use client";

// Le lecteur qui reprend où on s'est arrêté.
//
// YouTube n'expose pas d'API de progression sans charger son SDK ; on parle
// donc directement à l'iframe via postMessage (`enablejsapi=1`). Le lecteur
// répond avec des messages `infoDelivery` contenant la position — d'où le
// sondage toutes les 2 s et la sauvegarde toutes les 5 s.
//
// La position est aussi forcée sur pause, sur passage en arrière-plan et au
// démontage : c'est ce qui évite de perdre les dernières minutes quand on ferme
// l'onglet d'un coup.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { LessonSource } from "@/lib/curriculum";
import { formatClock, formatDateTime } from "@/lib/format";
import { Status } from "./window";
import {
  getResumableSegment,
  isSegmentComplete,
  normalizeLessonProgress,
  parseYouTubeProgressMessage,
  trackedPlayerUrl,
  type LessonProgress,
} from "@/lib/lesson-progress";

type SaveStatus = "loading" | "ready" | "saving" | "saved" | "offline";

export function TrackedVideo({
  lessonId,
  source,
  availableMinutes,
  title,
}: {
  lessonId: string;
  source: LessonSource;
  availableMinutes: number;
  title: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [progress, setProgress] = useState<LessonProgress>(() => normalizeLessonProgress(null, lessonId, source.url));
  const [resumePosition, setResumePosition] = useState(0);
  const [positionSeconds, setPositionSeconds] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(source.totalMinutes ? source.totalMinutes * 60 : 0);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("loading");

  const iframeRef = useRef<HTMLIFrameElement>(null);
  // Des refs plutôt que l'état pour ce que lisent les timers : un setInterval
  // capturerait sinon la valeur du rendu où il a été créé.
  const positionRef = useRef(0);
  const durationRef = useRef(durationSeconds);
  const completedRef = useRef(false);
  const lastSavedRef = useRef(-1);

  const segment = useMemo(
    () => getResumableSegment(source, availableMinutes, resumePosition),
    [availableMinutes, resumePosition, source],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch(`/api/progress/${encodeURIComponent(lessonId)}`, { cache: "no-store" });
        const body = response.status === 404 ? null : await response.json();
        if (!active) return;

        const next = normalizeLessonProgress(body, lessonId, source.url);
        setProgress(next);
        setResumePosition(next.positionSeconds);
        setPositionSeconds(next.positionSeconds);
        setDurationSeconds(next.durationSeconds || (source.totalMinutes ? source.totalMinutes * 60 : 0));
        positionRef.current = next.positionSeconds;
        durationRef.current = next.durationSeconds;
        completedRef.current = next.completed;
        lastSavedRef.current = next.positionSeconds;
        setSaveStatus(response.ok || response.status === 404 ? "ready" : "offline");
      } catch {
        if (active) setSaveStatus("offline");
      } finally {
        if (active) setLoaded(true);
      }
    }
    void load();
    return () => { active = false; };
  }, [lessonId, source.totalMinutes, source.url]);

  const persist = useCallback(async (markCompleted = completedRef.current, force = false) => {
    const position = Math.max(0, Math.floor(positionRef.current));
    const duration = Math.max(0, Math.floor(durationRef.current));
    // Moins de 2 s d'écart, rien de neuf à écrire : inutile de solliciter le
    // stockage toutes les 5 secondes sur une vidéo en pause.
    if (!force && !markCompleted && Math.abs(position - lastSavedRef.current) < 2) return;

    setSaveStatus("saving");
    try {
      const response = await fetch(`/api/progress/${encodeURIComponent(lessonId)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sourceUrl: source.url,
          positionSeconds: position,
          durationSeconds: duration,
          completed: markCompleted,
        }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("Sauvegarde refusée");
      const next = normalizeLessonProgress(await response.json(), lessonId, source.url);
      completedRef.current = next.completed;
      lastSavedRef.current = next.positionSeconds;
      setProgress(next);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("offline");
    }
  }, [lessonId, source.url]);

  const command = useCallback((func: string, args: unknown[] = []) => {
    if (!source.embedUrl) return;
    const origin = new URL(source.embedUrl).origin;
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args, id: lessonId }),
      origin,
    );
  }, [lessonId, source.embedUrl]);

  const connect = useCallback(() => {
    if (!source.embedUrl) return;
    const origin = new URL(source.embedUrl).origin;
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: lessonId }), origin);
    command("addEventListener", ["onStateChange"]);
    command("getCurrentTime");
    command("getDuration");
  }, [command, lessonId, source.embedUrl]);

  useEffect(() => {
    if (!loaded) return;

    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const update = parseYouTubeProgressMessage(event.origin, event.data);
      if (!update) return;

      positionRef.current = update.currentTime;
      setPositionSeconds(update.currentTime);
      if (update.duration > 0) {
        durationRef.current = update.duration;
        setDurationSeconds(update.duration);
      }

      const finished = isSegmentComplete(update.currentTime, segment.endSeconds);
      // playerState 0 = terminé, 2 = pause.
      if ((update.playerState === 0 || finished) && !completedRef.current) {
        completedRef.current = true;
        void persist(true, true);
      } else if (update.playerState === 2) {
        void persist(completedRef.current, true);
      }
    };

    window.addEventListener("message", onMessage);
    const poll = window.setInterval(() => { command("getCurrentTime"); command("getDuration"); }, 2_000);
    const autosave = window.setInterval(() => void persist(), 5_000);
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void persist(completedRef.current, true);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("message", onMessage);
      window.clearInterval(poll);
      window.clearInterval(autosave);
      document.removeEventListener("visibilitychange", onVisibility);
      void persist(completedRef.current, true);
    };
  }, [command, loaded, persist, segment.endSeconds]);

  if (!source.embedUrl) {
    return (
      <div className="bx-reading">
        <p className="bx-muted">Cette capsule est une lecture guidée.</p>
        <strong>{source.segmentLabel}</strong>
        <a className="bx-link" href={source.url} target="_blank" rel="noreferrer">
          Ouvrir la ressource officielle
        </a>
      </div>
    );
  }

  if (!loaded) {
    return <div className="bx-loader" role="status">Chargement de ta reprise…</div>;
  }

  const fullDuration = durationSeconds || (source.totalMinutes ? source.totalMinutes * 60 : segment.endSeconds);
  const watchedPercent = fullDuration ? Math.min(100, Math.round((positionSeconds / fullDuration) * 100)) : 0;
  const statusCopy =
    saveStatus === "saving" ? "Sauvegarde…"
    : saveStatus === "offline" ? "Sauvegarde hors ligne"
    : `Sauvegardé à ${formatClock(positionSeconds)}`;

  return (
    <div>
      <div className="bx-video">
        <iframe
          ref={iframeRef}
          src={trackedPlayerUrl(source, segment.startSeconds, segment.endSeconds)}
          title={`${title} — segment ${segment.startLabel} à ${segment.endLabel}`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          onLoad={connect}
        />
      </div>

      <div className="bx-video-meta">
        <div className="bx-between">
          <strong>
            {progress.completed
              ? "Leçon terminée"
              : positionSeconds > 0
                ? `Reprise à ${formatClock(positionSeconds)}`
                : "Progression automatique activée"}
          </strong>
          <Status on={saveStatus !== "offline"}>{statusCopy}</Status>
        </div>

        <div className="bx-meter" aria-label={`${watchedPercent} % de la vidéo consultée`}>
          <span style={{ width: `${watchedPercent}%` }} />
        </div>

        <div className="bx-between">
          <small>
            Capsule · {segment.startLabel} → {segment.endLabel} · vu {formatClock(positionSeconds)} / {formatClock(fullDuration)}
          </small>
          {progress.completed ? (
            <Status on>Terminé</Status>
          ) : (
            <button type="button" className="bx-btn" onClick={() => void persist(true, true)}>
              Marquer terminé
            </button>
          )}
        </div>

        {progress.lastWatchedAt ? (
          <small>Dernière consultation · {formatDateTime(progress.lastWatchedAt)}</small>
        ) : null}
      </div>
    </div>
  );
}
