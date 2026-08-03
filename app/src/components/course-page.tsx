"use client";

import { useEffect, useMemo, useState } from "react";

import { subjects, subjectById } from "@/lib/curriculum";
import { formatClock, formatDate, formatMinutes, getSourceSegment } from "@/lib/format";
import { blockCopy, blockLabels, buildStudyPlan, scheduleStudyPlan } from "@/lib/study-plan";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Card } from "./window";

export function CoursePage() {
  const {
    duration,
    selectedSubjectId,
    secondsRemaining,
    isRunning,
    notes,
    selectSubject,
    toggleTimer,
    resetTimer,
    setNote,
  } = useStudy();

  const [focusOpen, setFocusOpen] = useState(false);
  const [notesVisible, setNotesVisible] = useState(true);
  const [lessonIndex, setLessonIndex] = useState(0);

  const subject = subjectById(selectedSubjectId);
  const lesson = subject.lessons[Math.min(lessonIndex, subject.lessons.length - 1)];
  const source = lesson.source;

  const plan = useMemo(() => buildStudyPlan({ minutes: duration, dueCards: 0 }), [duration]);
  const schedule = scheduleStudyPlan(plan);
  const learnBlock = schedule.find((block) => block.kind === "learn") ?? schedule[0];
  const segment = getSourceSegment(source, learnBlock.minutes);
  const note = notes[subject.id] ?? "";

  // Changer de matière remet la leçon au début de SA liste : sinon on ouvrirait
  // la leçon 4 d'une matière qui n'en a que deux.
  useEffect(() => { setLessonIndex(0); }, [selectedSubjectId]);

  useEffect(() => {
    if (!focusOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [focusOpen]);

  // La clé force le remontage du lecteur : deux iframes YouTube sur la même
  // leçon se disputeraient les messages de progression.
  const player = (mode: string) => (
    <TrackedVideo
      key={`${lesson.id}-${mode}`}
      lessonId={lesson.id}
      source={source}
      availableMinutes={learnBlock.minutes}
      title={lesson.title}
    />
  );

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={source.provider} right={source.kind === "video" ? "Vidéo" : source.kind === "reading" ? "Lecture" : "Interactif"}>
          <div className="bx-page-head">
            <h1>{lesson.title}</h1>
            <p className="bx-page-intro">{lesson.objective}</p>
          </div>

          <div className="bx-segmented" role="group" aria-label="Choisir une matière">
            {subjects.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === subject.id}
                onClick={() => selectSubject(item.id)}
              >
                {item.icon} {item.title}
              </button>
            ))}
          </div>

          {!focusOpen ? player("course") : <p className="bx-muted">Lecture en cours dans le mode focus.</p>}

          <div className="bx-metric-grid">
            <div className="bx-metric">
              <span className="bx-metric-value">{formatMinutes(segment.watchMinutes)}</span>
              <span className="bx-metric-label">Capsule prévue</span>
            </div>
            <div className="bx-metric">
              <span className="bx-metric-value">
                {source.totalMinutes ? formatMinutes(source.totalMinutes) : "—"}
              </span>
              <span className="bx-metric-label">Ressource complète</span>
            </div>
          </div>

          <div className="bx-note">
            <strong>Intention de visionnage</strong>
            {source.segmentLabel} — {source.why}
          </div>

          <div className="bx-note">
            <strong>Gratuit, vérifié le {formatDate(source.verifiedAt)}</strong>
            {source.accessNote}
          </div>

          <div className="bx-between">
            <button type="button" className="bx-btn" onClick={() => setFocusOpen(true)}>Mode focus</button>
            <a className="bx-link" href={source.url} target="_blank" rel="noreferrer">Source officielle →</a>
          </div>
        </Card>

        <Card title="Tes notes" right={note.length > 0 ? `${note.length} caractères` : "vide"}>
          <textarea
            className="bx-textarea"
            value={note}
            onChange={(event) => setNote(subject.id, event.target.value)}
            placeholder={"Écris peu, mais utile :\n\n- une idée reformulée avec tes mots\n- un exemple qui vient de ton terrain\n- une question encore ouverte"}
          />
          <p className="bx-muted">Sauvegarde automatique, 700 ms après ta dernière frappe.</p>
        </Card>
      </div>

      <div className="bx-col">
        <Card title="Ta séquence" right={formatMinutes(duration)}>
          {schedule.map((block, index) => (
            <div key={`${block.kind}-${index}`} className={block.kind === "learn" ? "bx-task" : "bx-task bx-task-idle"}>
              <span className="bx-task-meta">{formatClock(block.startsAtMinute * 60)}</span>
              <span className="bx-task-title">{blockLabels[block.kind]}</span>
              <span className="bx-task-meta">{block.minutes} min</span>
            </div>
          ))}
          <p className="bx-muted">{blockCopy[learnBlock.kind]}</p>
        </Card>

        <Card title="À pouvoir expliquer">
          <ul className="bx-list">
            {lesson.keyTakeaways.map((takeaway) => <li key={takeaway}><span>{takeaway}</span></li>)}
          </ul>
        </Card>

        {subject.lessons.length > 1 ? (
          <Card title="Cette matière" right={`${subject.lessons.length} leçons`}>
            {subject.lessons.map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="bx-row"
                onClick={() => setLessonIndex(index)}
                aria-current={index === lessonIndex ? "true" : undefined}
              >
                <span className="bx-row-icon" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                <span className="bx-row-body">
                  <span className="bx-row-title">{item.title}</span>
                  <span className="bx-row-meta">{item.source.provider}</span>
                </span>
                <span className="bx-row-open">Ouvrir →</span>
              </button>
            ))}
          </Card>
        ) : null}

        {lesson.alternatives.length > 0 ? (
          <Card title="Sources de repli">
            {lesson.alternatives.map((alternative) => (
              <a
                key={alternative.url}
                className="bx-row"
                href={alternative.url}
                target="_blank"
                rel="noreferrer"
              >
                <span className="bx-row-icon" aria-hidden="true">↗</span>
                <span className="bx-row-body">
                  <span className="bx-row-title">{alternative.title}</span>
                  <span className="bx-row-meta">{alternative.provider}</span>
                </span>
                <span className="bx-row-open">Ouvrir →</span>
              </a>
            ))}
          </Card>
        ) : null}
      </div>

      {focusOpen ? (
        <div className="bx-focus" role="dialog" aria-modal="true" aria-labelledby="focus-title">
          <header className="bx-focus-head">
            <div>
              <p className="bx-overline">{subject.title} · {source.segmentLabel}</p>
              <h2 id="focus-title" style={{ fontSize: "1.2rem", marginTop: 3 }}>{lesson.title}</h2>
            </div>
            <div className="bx-inline">
              <span className="bx-clock" style={{ fontSize: "1.4rem" }} aria-live="polite">{formatClock(secondsRemaining)}</span>
              <button type="button" className="bx-btn" onClick={toggleTimer}>{isRunning ? "Pause" : "Démarrer"}</button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={resetTimer}>Réinitialiser</button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={() => setNotesVisible((current) => !current)}>
                {notesVisible ? "Agrandir" : "Notes"}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={() => setFocusOpen(false)}>Quitter</button>
            </div>
          </header>

          <div className={notesVisible ? "bx-focus-body" : "bx-focus-body is-wide"}>
            <div className="bx-col">
              <div className="bx-card">
                {player("focus")}
                <div className="bx-note">
                  <strong>Question à garder en tête</strong>
                  {lesson.objective}
                </div>
              </div>
            </div>

            {notesVisible ? (
              <div className="bx-col">
                <Card title="Notes connectées">
                  <textarea
                    autoFocus
                    className="bx-textarea"
                    value={note}
                    onChange={(event) => setNote(subject.id, event.target.value)}
                    placeholder="Une idée par ligne. Tes mots, pas ceux du cours."
                  />
                  <div className="bx-note">
                    <strong>Après la vidéo</strong>
                    Ferme le cours et explique l&apos;idée principale sans relire tes notes.
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
