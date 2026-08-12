"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";

import { subjectById } from "@/lib/curriculum";
import type { RewardGrant } from "@/lib/rewards";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { useRewards } from "./rewards-context";
import { useStudy } from "./study-context";
import { Card } from "./window";

type CoachResponse = {
  status?: "completed" | "manual" | "failed";
  feedback?: string;
  prompt?: string;
  provider?: string;
  hint?: string;
  error?: string;
  reward?: RewardGrant | null;
};

type HistoryEntry = {
  id: string;
  lessonId: string;
  question: string;
  answer: string;
  feedback: string | null;
  createdAt: string;
};

export function ExercisesPage() {
  const { curriculum } = useCurriculum();
  const { t, formatDate } = useLocale();
  const { recordGrant } = useRewards();
  const { selectedSubjectId } = useStudy();
  const subject = subjectById(selectedSubjectId, curriculum);
  const lesson = subject.lesson;

  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const pendingEventId = useRef<string | null>(null);

  const loadHistory = () => {
    fetch("/api/coach", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { answers: [] }))
      .then((body: { answers?: HistoryEntry[] }) => setHistory(body.answers ?? []))
      .catch(() => undefined);
  };

  useEffect(loadHistory, []);

  const wordCount = answer.trim() ? answer.trim().split(/\s+/).length : 0;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setResult(null);
    setCopied(false);
    pendingEventId.current ??= crypto.randomUUID();

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: pendingEventId.current, lessonId: lesson.id, answer }),
      });
      const body = await response.json() as CoachResponse;
      setResult(response.ok ? body : { status: "failed", error: body.error ?? t("exercises.correctionError") });
      recordGrant(body.reward);
      pendingEventId.current = null;
      loadHistory();
    } catch {
      setResult({ status: "failed", error: t("exercises.serverError") });
    } finally {
      setStatus("idle");
    }
  }

  async function copyPrompt() {
    if (!result?.prompt) return;
    try {
      await navigator.clipboard.writeText(result.prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      // Presse-papiers refusé (contexte non sécurisé) : le prompt reste affiché
      // et sélectionnable, rien n'est perdu.
    }
  }

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={t("exercises.dailyQuestion")} right={subject.title}>
          <div className="bx-page-head">
            <p className="bx-overline">{t("exercises.space")}</p>
            <h1>{t("exercises.title")}</h1>
          </div>

          <p style={{ fontSize: "1rem", lineHeight: 1.45, fontWeight: 700 }}>{lesson.prompt}</p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div className="bx-field">
              <label className="bx-label" htmlFor="answer">{t("exercises.answerLabel")}</label>
              <textarea
                id="answer"
                className="bx-textarea"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder={t("exercises.placeholder")}
              />
            </div>

            <div className="bx-between">
              <button type="submit" className="bx-btn" disabled={status === "sending" || wordCount < 20}>
                {status === "sending" ? t("exercises.correcting") : t("exercises.submit")}
              </button>
              <span className="bx-muted">
                {t(wordCount > 1 ? "exercises.words" : "exercises.word", { count: wordCount })}
                {wordCount < 20 ? ` · ${t("exercises.wordsRemaining", { count: 20 - wordCount })}` : ""}
              </span>
            </div>
          </form>

          {result?.status === "completed" ? <div className="bx-feedback">{result.feedback}</div> : null}

          {result?.status === "manual" ? (
            <>
              <div className="bx-note">
                <strong>{t("exercises.manualTitle")}</strong>
                {result.hint}
              </div>
              <pre className="bx-code">{result.prompt}</pre>
              <div className="bx-inline">
                <button type="button" className="bx-btn" onClick={copyPrompt}>
                  {copied ? t("exercises.copied") : t("exercises.copyPrompt")}
                </button>
                <span className="bx-muted">{t("exercises.savedHistory")}</span>
              </div>
            </>
          ) : null}

          {result?.status === "failed" ? <div className="bx-feedback">{result.error}</div> : null}
        </Card>
      </div>

      <div className="bx-col">
        <Card title={t("exercises.protocol")}>
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">01</span>
            <span className="bx-task-title">{t("exercises.retrieve")}</span>
          </div>
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">02</span>
            <span className="bx-task-title">{t("exercises.transfer")}</span>
          </div>
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">03</span>
            <span className="bx-task-title">{t("exercises.repair")}</span>
          </div>
        </Card>

        <Card title={t("exercises.checkpoints")}>
          {showReference ? (
            <ul className="bx-list">
              {lesson.keyTakeaways.map((item) => <li key={item}><span>{item}</span></li>)}
            </ul>
          ) : (
            <p className="bx-muted">
              {t("exercises.effortFirst")}
            </p>
          )}
          <button type="button" className="bx-link" onClick={() => setShowReference((current) => !current)}>
            {showReference ? t("exercises.hideReference") : t("exercises.compareReference")}
          </button>
        </Card>

        {history.length > 0 ? (
          <Card title={t("exercises.history")} right={t("exercises.answers", { count: history.length })}>
            {history.slice(0, 6).map((entry) => (
              <div key={entry.id} className="bx-row">
                <span className="bx-row-icon" aria-hidden="true">✎</span>
                <span className="bx-row-body">
                  <span className="bx-row-title">{entry.answer.split(/\s+/).length} mots</span>
                  <span className="bx-row-meta">
                    {formatDate(entry.createdAt)} · {entry.feedback ? t("exercises.corrected") : t("exercises.pending")}
                  </span>
                </span>
              </div>
            ))}
          </Card>
        ) : null}
      </div>
    </>
  );
}
