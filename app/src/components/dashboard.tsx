"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { curriculum, dailyCards, subjectById } from "@/lib/curriculum";
import { formatClock, formatDate, formatMinutes, getSourceSegment } from "@/lib/format";
import { blockLabels, buildStudyPlan, scheduleStudyPlan, studyDurations } from "@/lib/study-plan";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Card } from "./window";

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
      <div className="bx-col bx-col-wide">
        <Card title="Aujourd'hui" right={`${subject.title} · ${subject.progress} %`}>
          <div className="bx-page-head">
            <h1>{lesson.title}</h1>
            <p className="bx-page-intro">{lesson.objective}</p>
          </div>

          <TrackedVideo
            lessonId={lesson.id}
            source={lesson.source}
            availableMinutes={learnBlock.minutes}
            title={lesson.title}
          />

          <div className="bx-metric-grid">
            <div className="bx-metric">
              <span className="bx-metric-value">{formatMinutes(segment.watchMinutes)}</span>
              <span className="bx-metric-label">À regarder</span>
            </div>
            <div className="bx-metric">
              <span className="bx-metric-value">{segment.startLabel}</span>
              <span className="bx-metric-label">Reprise à</span>
            </div>
          </div>

          <div className="bx-note">
            <strong>Pourquoi cette source</strong>
            {lesson.source.why}
          </div>

          <div className="bx-field">
            <span className="bx-label">Temps dont tu disposes</span>
            <div className="bx-segmented" role="group" aria-label="Choisir la durée de la session">
              {studyDurations.map((minutes) => (
                <button
                  key={minutes}
                  type="button"
                  aria-pressed={duration === minutes}
                  onClick={() => chooseDuration(minutes)}
                >
                  {formatMinutes(minutes)}
                </button>
              ))}
            </div>
          </div>

          <div className="bx-between">
            <Link className="bx-btn" href="/learning">Ouvrir le cours</Link>
            <span className="bx-muted">{duration} minutes · {plan.blocks.length} étapes</span>
          </div>
        </Card>

        <Card title="Le rythme" right={`adapté à ${formatMinutes(duration)}`}>
          {schedule.map((block, index) => (
            <div key={`${block.kind}-${index}`} className={block.kind === "learn" ? "bx-task" : "bx-task bx-task-idle"}>
              <span className="bx-task-meta">{formatClock(block.startsAtMinute * 60)}</span>
              <span className="bx-task-title">{blockLabels[block.kind]}</span>
              <span className="bx-task-meta">{block.minutes} min</span>
            </div>
          ))}
        </Card>
      </div>

      <div className="bx-col">
        <Card title="Session">
          <p className="bx-clock" aria-live="polite">{formatClock(secondsRemaining)}</p>
          <div className="bx-meter" aria-label={`${sessionProgress} % de la session`}>
            <span style={{ width: `${sessionProgress}%` }} />
          </div>
          <p className="bx-muted">
            {isRunning ? "La session avance. Une seule tâche à la fois." : "Le timer reste actif pendant la navigation."}
          </p>
          <button type="button" className="bx-btn" onClick={toggleTimer}>
            {secondsRemaining === 0 ? "Recommencer" : isRunning ? "Mettre en pause" : "Démarrer"}
          </button>
        </Card>

        <Card title="Révisions" right={`${dueCount} dues`}>
          <div className="bx-metric">
            <span className="bx-metric-value">{dueCount}</span>
            <span className="bx-metric-label">cartes à récupérer aujourd&apos;hui</span>
          </div>
          <p className="bx-muted">
            Réponds avant de retourner la carte. Ta note de difficulté décide de la prochaine date.
          </p>
          <Link href="/reviews" className="bx-link">Ouvrir la file →</Link>
        </Card>

        <Card title="Objectif">
          <p style={{ fontSize: "0.88rem", lineHeight: 1.5 }}>{curriculum.goal}</p>
          <div>
            <div className="bx-stat"><span>Matières</span><strong>{curriculum.subjects.length}</strong></div>
            <div className="bx-stat"><span>Curriculum</span><strong>{formatDate(curriculum.generatedAt)}</strong></div>
            <div className="bx-stat"><span>Accès aux sources</span><strong>0 €</strong></div>
          </div>
          <Link href="/settings" className="bx-link">Réglages →</Link>
        </Card>
      </div>
    </>
  );
}
