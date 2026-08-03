"use client";

import { useEffect, useMemo, useState } from "react";

import { subjects, subjectById } from "@/lib/curriculum";
import { formatClock, formatDate, formatMinutes, getSourceSegment } from "@/lib/format";
import { blockCopy, blockLabels, buildStudyPlan, scheduleStudyPlan } from "@/lib/study-plan";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Win } from "./window";

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

  // Changer de matière remet la leçon au début de SA liste, pas à l'index
  // courant — sinon on ouvrirait la leçon 4 d'une matière qui n'en a que deux.
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

  // La clé force le remontage du lecteur quand on change de leçon ou qu'on passe
  // en focus : deux iframes YouTube sur la même leçon se disputeraient les
  // messages de progression.
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
      <div className="bx-page-head">
        <div>
          <p className="bx-overline">Espace cours</p>
          <h1>Comprendre avant d&apos;accumuler.</h1>
        </div>
        <p className="bx-page-intro">
          La source est découpée selon ton temps disponible. Tu ne regardes jamais un cours entier par défaut.
        </p>
      </div>

      <div className="bx-subject-tabs" role="group" aria-label="Choisir une matière">
        {subjects.map((item) => (
          <button
            key={item.id}
            type="button"
            className="bx-btn"
            aria-pressed={item.id === subject.id}
            onClick={() => selectSubject(item.id)}
          >
            <span className="bx-icon" aria-hidden="true">{item.icon}</span>
            {item.title}
          </button>
        ))}
      </div>

      <div className="bx-split">
        <div className="bx-stack">
          <Win title={source.provider} right={source.kind === "video" ? "Vidéo" : source.kind === "reading" ? "Lecture" : "Interactif"}>
            <div className="bx-row-between">
              <h2>{lesson.title}</h2>
              <button type="button" className="bx-btn bx-btn-accent" onClick={() => setFocusOpen(true)}>
                Mode focus
              </button>
            </div>

            {!focusOpen ? player("course") : <p className="bx-muted">Lecture en cours dans le mode focus.</p>}

            <div className="bx-source-strip">
              <div>
                <span>Capsule prévue</span>
                <strong>{formatMinutes(segment.watchMinutes)} · reprise auto</strong>
              </div>
              <div>
                <span>Moment dans la session</span>
                <strong>
                  {formatClock(learnBlock.startsAtMinute * 60)} → {formatClock((learnBlock.startsAtMinute + segment.watchMinutes) * 60)}
                </strong>
              </div>
              <div>
                <span>Ressource complète</span>
                <strong>{source.totalMinutes ? formatMinutes(source.totalMinutes) : "Ressource ouverte"}</strong>
              </div>
            </div>

            <div>
              <p className="bx-overline">Intention de visionnage</p>
              <h3 style={{ marginTop: 6 }}>{source.segmentLabel}</h3>
              <p className="bx-muted" style={{ marginTop: 6 }}>{source.why}</p>
            </div>

            <div className="bx-proof">
              <strong>Gratuit vérifié le {formatDate(source.verifiedAt)}</strong>
              <p>{source.accessNote}</p>
              <a className="bx-link-action" href={source.url} target="_blank" rel="noreferrer">
                Voir la source officielle
              </a>
            </div>

            {lesson.alternatives.length > 0 ? (
              <div>
                <p className="bx-overline">Sources de repli</p>
                <ul className="bx-list" style={{ marginTop: 8 }}>
                  {lesson.alternatives.map((alternative) => (
                    <li key={alternative.url}>
                      <span>
                        <a href={alternative.url} target="_blank" rel="noreferrer">{alternative.title}</a>
                        {" — "}{alternative.provider}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Win>

          <Win title="Tes notes" right={note.length > 0 ? `${note.length} caractères` : "vide"}>
            <textarea
              className="bx-textarea"
              value={note}
              onChange={(event) => setNote(subject.id, event.target.value)}
              placeholder={"Écris peu, mais utile :\n\n- une idée reformulée avec tes mots\n- un exemple qui vient de ton terrain\n- une question encore ouverte"}
            />
            <p className="bx-muted">Sauvegarde automatique, 700 ms après ta dernière frappe.</p>
          </Win>
        </div>

        <div className="bx-stack">
          <Win title="Ta séquence" right={formatMinutes(duration)}>
            <ol className="bx-sequence">
              {schedule.map((block, index) => (
                <li key={`${block.kind}-${index}`} className={block.kind === "learn" ? "is-current" : undefined}>
                  <time>{formatClock(block.startsAtMinute * 60)}</time>
                  <div>
                    <strong>{blockLabels[block.kind]} · {block.minutes} min</strong>
                    <p>{blockCopy[block.kind]}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Win>

          <Win title="À pouvoir expliquer">
            <ul className="bx-list">
              {lesson.keyTakeaways.map((takeaway) => <li key={takeaway}><span>{takeaway}</span></li>)}
            </ul>
          </Win>

          {subject.lessons.length > 1 ? (
            <Win title="Cette matière" right={`${subject.lessons.length} leçons`}>
              <ol className="bx-sequence">
                {subject.lessons.map((item, index) => (
                  <li key={item.id} className={index === lessonIndex ? "is-current" : undefined}>
                    <time>{String(index + 1).padStart(2, "0")}</time>
                    <div>
                      <button
                        type="button"
                        className="bx-btn bx-btn-ghost"
                        style={{ padding: 0, textAlign: "left" }}
                        onClick={() => setLessonIndex(index)}
                      >
                        {item.title}
                      </button>
                    </div>
                  </li>
                ))}
              </ol>
            </Win>
          ) : null}
        </div>
      </div>

      {focusOpen ? (
        <div className="bx-focus" role="dialog" aria-modal="true" aria-labelledby="focus-title">
          <header className="bx-focus-head">
            <div>
              <p className="bx-overline">{subject.title} · {source.segmentLabel}</p>
              <h2 id="focus-title" style={{ fontSize: 18, marginTop: 4 }}>{lesson.title}</h2>
            </div>
            <div className="bx-focus-controls">
              <span className="bx-focus-clock" aria-live="polite">{formatClock(secondsRemaining)}</span>
              <button type="button" className="bx-btn" onClick={toggleTimer}>{isRunning ? "Pause" : "Démarrer"}</button>
              <button type="button" className="bx-btn" onClick={resetTimer}>Réinitialiser</button>
              <button type="button" className="bx-btn" onClick={() => setNotesVisible((current) => !current)}>
                {notesVisible ? "Agrandir la vidéo" : "Afficher les notes"}
              </button>
              <button type="button" className="bx-btn bx-btn-danger" onClick={() => setFocusOpen(false)}>Quitter</button>
            </div>
          </header>

          <div className={notesVisible ? "bx-focus-body" : "bx-focus-body notes-hidden"}>
            <div className="bx-stack">
              {player("focus")}
              <div className="bx-proof">
                <strong>Question à garder en tête</strong>
                <p>{lesson.objective}</p>
              </div>
            </div>

            {notesVisible ? (
              <Win title="Notes connectées">
                <textarea
                  autoFocus
                  className="bx-textarea"
                  value={note}
                  onChange={(event) => setNote(subject.id, event.target.value)}
                  placeholder="Une idée par ligne. Tes mots, pas ceux du cours."
                />
                <div className="bx-proof">
                  <strong>Après la vidéo</strong>
                  <p>Ferme le cours et explique l&apos;idée principale sans relire tes notes.</p>
                </div>
              </Win>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
