"use client";

import { useEffect, useMemo, useState } from "react";

import { subjectById } from "@/lib/curriculum";
import { formatClock, formatMinutes, getSourceSegment } from "@/lib/format";
import type { LocaleKey } from "@/lib/i18n";
import { buildStudyPlan, scheduleStudyPlan } from "@/lib/study-plan";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Card } from "./window";

export function CoursePage() {
  const { curriculum } = useCurriculum();
  const { locale, t, formatDate } = useLocale();
  const subjects = curriculum.subjects;
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

  const subject = subjectById(selectedSubjectId, curriculum);
  const lesson = subject.lessons[Math.min(lessonIndex, subject.lessons.length - 1)];
  const source = lesson.source;
  const videoMatchesLocale = source.language.toLowerCase().split(/[-_]/, 1)[0] === locale;

  const plan = useMemo(() => buildStudyPlan({ minutes: duration, dueCards: 0 }), [duration]);
  const schedule = scheduleStudyPlan(plan);
  const learnBlock = schedule.find((block) => block.kind === "learn") ?? schedule[0];
  const segment = getSourceSegment(source, learnBlock.minutes);
  const note = notes[subject.id] ?? "";

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
  const player = (mode: string) => videoMatchesLocale ? (
    <TrackedVideo
      key={`${lesson.id}-${mode}`}
      lessonId={lesson.id}
      source={source}
      availableMinutes={learnBlock.minutes}
      title={lesson.title}
    />
  ) : (
    <div className="bx-note" role="status">{t("course.videoLanguageUnavailable")}</div>
  );

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={source.provider} right={t("common.video")}>
          <div className="bx-page-head">
            <h1>{lesson.title}</h1>
            <p className="bx-page-intro">{lesson.objective}</p>
          </div>

          <div className="bx-segmented" role="group" aria-label={t("course.chooseSubject")}>
            {subjects.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === subject.id}
                onClick={() => {
                  // Une matière s'ouvre toujours sur sa première leçon.
                  setLessonIndex(0);
                  selectSubject(item.id);
                }}
              >
                {item.icon} {item.title}
              </button>
            ))}
          </div>

          {!focusOpen ? player("course") : <p className="bx-muted">{t("course.focusVideoPlaying")}</p>}

          <div className="bx-metric-grid">
            <div className="bx-metric">
              <span className="bx-metric-value">{formatMinutes(segment.watchMinutes)}</span>
              <span className="bx-metric-label">{t("course.plannedCapsule")}</span>
            </div>
            <div className="bx-metric">
              <span className="bx-metric-value">
                {source.totalMinutes ? formatMinutes(source.totalMinutes) : "—"}
              </span>
              <span className="bx-metric-label">{t("course.fullResource")}</span>
            </div>
          </div>

          <div className="bx-note">
            <strong>{t("course.watchingIntent")}</strong>
            {source.segmentLabel} — {source.why}
          </div>

          <div className="bx-note">
            <strong>{t("course.verifiedFree", { date: formatDate(source.verifiedAt) })}</strong>
            {source.accessNote}
          </div>

          <div className="bx-between">
            <button type="button" className="bx-btn" disabled={!videoMatchesLocale} onClick={() => setFocusOpen(true)}>{t("course.focusMode")}</button>
            {videoMatchesLocale ? <a className="bx-link" href={source.url} target="_blank" rel="noreferrer">{t("course.officialSource")}</a> : null}
          </div>
        </Card>

        <Card title={t("course.yourNotes")} right={note.length > 0 ? t("common.characters", { count: note.length }) : t("common.empty")}>
          <textarea
            className="bx-textarea"
            value={note}
            onChange={(event) => setNote(subject.id, event.target.value)}
            placeholder={t("course.notesPlaceholder")}
          />
          <p className="bx-muted">{t("course.autosave")}</p>
        </Card>
      </div>

      <div className="bx-col">
        <Card title={t("course.sequence")} right={formatMinutes(duration)}>
          {schedule.map((block, index) => (
            <div key={`${block.kind}-${index}`} className={block.kind === "learn" ? "bx-task" : "bx-task bx-task-idle"}>
              <span className="bx-task-meta">{formatClock(block.startsAtMinute * 60)}</span>
              <span className="bx-task-title">{t(`plan.${block.kind}` as LocaleKey)}</span>
              <span className="bx-task-meta">{block.minutes} min</span>
            </div>
          ))}
          <p className="bx-muted">{t(`plan.copy.${learnBlock.kind}` as LocaleKey)}</p>
        </Card>

        <Card title={t("course.explain")}>
          <ul className="bx-list">
            {lesson.keyTakeaways.map((takeaway) => <li key={takeaway}><span>{takeaway}</span></li>)}
          </ul>
        </Card>

        {subject.lessons.length > 1 ? (
          <Card title={t("course.thisSubject")} right={t("common.lessons", { count: subject.lessons.length })}>
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
                <span className="bx-row-open">{t("common.open")}</span>
              </button>
            ))}
          </Card>
        ) : null}

        {videoMatchesLocale && lesson.alternatives.length > 0 ? (
          <Card title={t("course.fallbackSources")}>
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
                <span className="bx-row-open">{t("common.open")}</span>
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
              <span className="bx-clock" style={{ fontSize: "1.4rem" }}>{formatClock(secondsRemaining)}</span>
              <button type="button" className="bx-btn" onClick={toggleTimer}>{isRunning ? t("plan.break") : t("course.focusStart")}</button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={resetTimer}>{t("course.focusReset")}</button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={() => setNotesVisible((current) => !current)}>
                {notesVisible ? t("course.focusExpand") : t("course.focusNotes")}
              </button>
              <button type="button" className="bx-btn bx-btn-ghost" onClick={() => setFocusOpen(false)}>{t("course.focusQuit")}</button>
            </div>
          </header>

          <div className={notesVisible ? "bx-focus-body" : "bx-focus-body is-wide"}>
            <div className="bx-col">
              <div className="bx-card">
                {player("focus")}
                <div className="bx-note">
                  <strong>{t("course.keepInMind")}</strong>
                  {lesson.objective}
                </div>
              </div>
            </div>

            {notesVisible ? (
              <div className="bx-col">
                <Card title={t("course.connectedNotes")}>
                  <textarea
                    autoFocus
                    className="bx-textarea"
                    value={note}
                    onChange={(event) => setNote(subject.id, event.target.value)}
                    placeholder={t("course.focusPlaceholder")}
                  />
                  <div className="bx-note">
                    <strong>{t("course.afterVideo")}</strong>
                    {t("course.afterVideoCopy")}
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
