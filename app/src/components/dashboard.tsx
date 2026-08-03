"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { curriculum, dailyCards, subjectById } from "@/lib/curriculum";
import { formatClock, formatDate, formatMinutes, getSourceSegment } from "@/lib/format";
import { blockLabels, buildStudyPlan, scheduleStudyPlan, studyDurations } from "@/lib/study-plan";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Win } from "./window";

export function Dashboard() {
  const { duration, selectedSubjectId, secondsRemaining, isRunning, chooseDuration, toggleTimer } = useStudy();
  const [dueCount, setDueCount] = useState(dailyCards.length);

  const subject = subjectById(selectedSubjectId);
  const lesson = subject.lesson;

  useEffect(() => {
    fetch("/api/cards", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { due?: unknown[] } | null) => {
        if (body?.due) setDueCount(body.due.length);
      })
      .catch(() => undefined);
  }, []);

  const plan = useMemo(() => buildStudyPlan({ minutes: duration, dueCards: dueCount }), [duration, dueCount]);
  const schedule = scheduleStudyPlan(plan);
  const learnBlock = schedule.find((block) => block.kind === "learn") ?? schedule[0];
  const segment = getSourceSegment(lesson.source, learnBlock.minutes);

  const elapsed = duration * 60 - secondsRemaining;
  const sessionProgress = Math.min(100, Math.max(0, Math.round((elapsed / (duration * 60)) * 100)));

  return (
    <>
      <div className="bx-page-head">
        <div>
          <p className="bx-overline">Programme du jour</p>
          <h1>Ta session est prête.</h1>
        </div>
        <p className="bx-page-intro">
          Tu n&apos;as rien à choisir : la prochaine étape, la source et le segment exact sont déjà décidés.
        </p>
      </div>

      <div className="bx-grid">
        <div className="bx-col-8 bx-stack">
          <Win title={`Aujourd'hui · ${subject.title}`} right={`${subject.progress} % du parcours`}>
            <div>
              <h2>{lesson.title}</h2>
              <p className="bx-muted" style={{ marginTop: 6 }}>{lesson.objective}</p>
            </div>

            <div className="bx-source-strip">
              <div>
                <span>Source gratuite vérifiée</span>
                <strong>{lesson.source.provider}</strong>
              </div>
              <div>
                <span>Partie à regarder</span>
                <strong>{segment.startLabel} → {segment.endLabel}</strong>
              </div>
              <div>
                <span>Dans ta session</span>
                <strong>
                  {formatClock(learnBlock.startsAtMinute * 60)} → {formatClock((learnBlock.startsAtMinute + segment.watchMinutes) * 60)}
                </strong>
              </div>
            </div>

            <TrackedVideo
              lessonId={lesson.id}
              source={lesson.source}
              availableMinutes={learnBlock.minutes}
              title={lesson.title}
            />

            <div className="bx-proof">
              <strong>Pourquoi cette source</strong>
              <p>{lesson.source.why}</p>
            </div>

            <div className="bx-field">
              <span className="bx-label">Temps dont tu disposes</span>
              <div className="bx-duration-picker" role="group" aria-label="Choisir la durée de la session">
                {studyDurations.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className="bx-btn"
                    aria-pressed={duration === minutes}
                    onClick={() => chooseDuration(minutes)}
                  >
                    {formatMinutes(minutes)}
                  </button>
                ))}
              </div>
            </div>

            <div className="bx-row-between">
              <Link className="bx-btn bx-btn-accent" href="/learning">Ouvrir le cours et mes notes</Link>
              <span className="bx-muted">{duration} minutes · {plan.blocks.length} étapes</span>
            </div>
          </Win>

          <Win title="Le rythme" right={`adapté à ${formatMinutes(duration)}`}>
            <ol className="bx-sequence">
              {schedule.map((block, index) => (
                <li key={`${block.kind}-${index}`} className={block.kind === "learn" ? "is-current" : undefined}>
                  <time>{formatClock(block.startsAtMinute * 60)}</time>
                  <div>
                    <strong>{blockLabels[block.kind]} · {block.minutes} min</strong>
                  </div>
                </li>
              ))}
            </ol>
          </Win>
        </div>

        <div className="bx-col-4 bx-stack">
          <Win title="Timer de session">
            <p className="bx-clock" aria-live="polite">{formatClock(secondsRemaining)}</p>
            <p className="bx-muted">
              {isRunning ? "La session avance. Une seule tâche à la fois." : "Le timer reste actif pendant la navigation."}
            </p>
            <div className="bx-meter" aria-label={`${sessionProgress} % de la session`}>
              <span style={{ width: `${sessionProgress}%` }} />
            </div>
            <button type="button" className="bx-btn bx-btn-accent" onClick={toggleTimer}>
              {secondsRemaining === 0 ? "Recommencer" : isRunning ? "Mettre en pause" : "Démarrer"}
            </button>
          </Win>

          <Win title="À récupérer aujourd'hui">
            <p className="bx-big">{dueCount}</p>
            <h2>cartes dues</h2>
            <p className="bx-muted">
              Réponds avant de retourner la carte. Ta note de difficulté décide de la prochaine date.
            </p>
            <Link href="/reviews" className="bx-link-action">Ouvrir la file de révision</Link>
          </Win>

          <Win title="Ton objectif">
            <p style={{ fontSize: 14, lineHeight: 1.55 }}>{curriculum.goal}</p>
            <div>
              <div className="bx-stat-row"><span>Matières</span><strong>{curriculum.subjects.length}</strong></div>
              <div className="bx-stat-row"><span>Curriculum généré</span><strong>{formatDate(curriculum.generatedAt)}</strong></div>
              <div className="bx-stat-row"><span>Accès aux sources</span><strong>0 €</strong></div>
            </div>
            <Link href="/settings" className="bx-link-action">Voir les réglages</Link>
          </Win>
        </div>
      </div>
    </>
  );
}
