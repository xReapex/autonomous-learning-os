"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { subjectById } from "@/lib/curriculum";
import { formatClock, formatMinutes, getSourceSegment } from "@/lib/format";
import type { LocaleKey } from "@/lib/i18n";
import { buildStudyPlan, scheduleStudyPlan, studyDurations } from "@/lib/study-plan";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { RewardSummary } from "./rewards-context";
import { useStudy } from "./study-context";
import { TrackedVideo } from "./tracked-video";
import { Card } from "./window";

export function Dashboard() {
  const { curriculum, revision } = useCurriculum();
  const { t } = useLocale();
  const { duration, selectedSubjectId, secondsRemaining, isRunning, chooseDuration, toggleTimer } = useStudy();
  const [dueCount, setDueCount] = useState(curriculum.cards.length);

  const subject = subjectById(selectedSubjectId, curriculum);
  const lesson = subject.lesson;

  useEffect(() => {
    fetch("/api/cards", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { due?: unknown[] } | null) => {
        if (body?.due) setDueCount(body.due.length);
      })
      .catch(() => undefined);
  }, [revision]);

  const plan = useMemo(() => buildStudyPlan({ minutes: duration, dueCards: dueCount }), [duration, dueCount]);
  const schedule = scheduleStudyPlan(plan);
  const learnBlock = schedule.find((block) => block.kind === "learn") ?? schedule[0];
  const segment = getSourceSegment(lesson.source, learnBlock.minutes);
  const elapsed = duration * 60 - secondsRemaining;
  const sessionProgress = Math.min(100, Math.max(0, Math.round((elapsed / (duration * 60)) * 100)));

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={t("dashboard.continue")} right={`${subject.title} · ${subject.progress} %`}>
          <div className="bx-page-head">
            <p className="bx-overline">{t("dashboard.today")}</p>
            <h1>{lesson.title}</h1>
            <p className="bx-page-intro">{lesson.objective}</p>
          </div>

          <TrackedVideo lessonId={lesson.id} source={lesson.source} availableMinutes={learnBlock.minutes} title={lesson.title} />

          <div className="bx-metric-grid">
            <div className="bx-metric">
              <span className="bx-metric-value">{formatMinutes(segment.watchMinutes)}</span>
              <span className="bx-metric-label">{t("dashboard.watch")}</span>
            </div>
            <div className="bx-metric">
              <span className="bx-metric-value">{segment.startLabel}</span>
              <span className="bx-metric-label">{t("dashboard.resumeAt")}</span>
            </div>
          </div>

          <details className="bx-disclosure">
            <summary>{t("dashboard.whySource")}</summary>
            <p>{lesson.source.why}</p>
          </details>

          <div className="bx-between bx-primary-action">
            <Link className="bx-btn" href="/learning">{t("dashboard.continueCourse")}</Link>
            <span className="bx-muted">{t("dashboard.session.steps", { minutes: duration, count: plan.blocks.length })}</span>
          </div>
        </Card>
      </div>

      <div className="bx-col">
        <Card title={t("dashboard.mySession")} right={`${sessionProgress} %`}>
          <div className="bx-session-head">
            <p className="bx-clock">{formatClock(secondsRemaining)}</p>
            <label className="bx-duration-select">
              <span className="bx-label">{t("dashboard.duration")}</span>
              <select className="bx-select" value={duration} onChange={(event) => chooseDuration(Number(event.target.value))}>
                {studyDurations.map((minutes) => <option key={minutes} value={minutes}>{formatMinutes(minutes)}</option>)}
              </select>
            </label>
          </div>
          <div className="bx-meter" aria-label={t("dashboard.sessionProgress", { progress: sessionProgress })}><span style={{ width: `${sessionProgress}%` }} /></div>
          <button type="button" className="bx-btn" onClick={toggleTimer}>
            {secondsRemaining === 0 ? t("dashboard.restart") : isRunning ? t("dashboard.pause") : t("dashboard.start")}
          </button>
          <details className="bx-disclosure">
            <summary>{t("dashboard.showPlan")}</summary>
            <div className="bx-stack">
              {schedule.map((block, index) => (
                <div key={`${block.kind}-${index}`} className={block.kind === "learn" ? "bx-task" : "bx-task bx-task-idle"}>
                  <span className="bx-task-meta">{formatClock(block.startsAtMinute * 60)}</span>
                  <span className="bx-task-title">{t(`plan.${block.kind}` as LocaleKey)}</span>
                  <span className="bx-task-meta">{block.minutes} min</span>
                </div>
              ))}
            </div>
          </details>
        </Card>

        <Card title={t("dashboard.toReview")} right={t("dashboard.dueToday", { count: dueCount })}>
          <div className="bx-review-summary">
            <span className="bx-metric-value">{dueCount}</span>
            <p>{t("dashboard.reviewCopy")}</p>
          </div>
          <Link href="/reviews" className="bx-btn bx-btn-ghost">{t("dashboard.openReviews")}</Link>
        </Card>

        <Card title={t("rewards.summary")}><RewardSummary /></Card>
      </div>
    </>
  );
}
