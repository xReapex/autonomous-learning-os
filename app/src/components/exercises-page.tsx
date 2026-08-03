"use client";

import { useEffect, useState, type FormEvent } from "react";

import { subjectById } from "@/lib/curriculum";
import { formatDate } from "@/lib/format";
import { useStudy } from "./study-context";
import { Card } from "./window";

type CoachResponse = {
  status?: "completed" | "manual" | "failed";
  feedback?: string;
  prompt?: string;
  provider?: string;
  hint?: string;
  error?: string;
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
  const { selectedSubjectId } = useStudy();
  const subject = subjectById(selectedSubjectId);
  const lesson = subject.lesson;

  const [answer, setAnswer] = useState("");
  const [status, setStatus] = useState<"idle" | "sending">("idle");
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [showReference, setShowReference] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [copied, setCopied] = useState(false);

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

    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lessonId: lesson.id, answer }),
      });
      const body = await response.json() as CoachResponse;
      setResult(response.ok ? body : { status: "failed", error: body.error ?? "Correction impossible." });
      loadHistory();
    } catch {
      setResult({ status: "failed", error: "Le serveur n'a pas répondu." });
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
        <Card title="Question du jour" right={subject.title}>
          <div className="bx-page-head">
            <p className="bx-overline">Espace exercices</p>
            <h1>Prouve que tu as compris.</h1>
          </div>

          <p style={{ fontSize: "1rem", lineHeight: 1.45, fontWeight: 700 }}>{lesson.prompt}</p>

          <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 13 }}>
            <div className="bx-field">
              <label className="bx-label" htmlFor="answer">Ta réponse, sans rouvrir le cours</label>
              <textarea
                id="answer"
                className="bx-textarea"
                value={answer}
                onChange={(event) => setAnswer(event.target.value)}
                placeholder="Explique le mécanisme, donne un exemple qui vient de ton terrain, puis cherche une limite…"
              />
            </div>

            <div className="bx-between">
              <button type="submit" className="bx-btn" disabled={status === "sending" || wordCount < 20}>
                {status === "sending" ? "Correction en cours…" : "Faire corriger"}
              </button>
              <span className="bx-muted">
                {wordCount} mot{wordCount > 1 ? "s" : ""}
                {wordCount < 20 ? ` · ${20 - wordCount} avant de pouvoir envoyer` : ""}
              </span>
            </div>
          </form>

          {result?.status === "completed" ? <div className="bx-feedback">{result.feedback}</div> : null}

          {result?.status === "manual" ? (
            <>
              <div className="bx-note">
                <strong>Aucune clé API n&apos;est configurée — c&apos;est voulu</strong>
                {result.hint}
              </div>
              <pre className="bx-code">{result.prompt}</pre>
              <div className="bx-inline">
                <button type="button" className="bx-btn" onClick={copyPrompt}>
                  {copied ? "Copié" : "Copier le prompt"}
                </button>
                <span className="bx-muted">Ta réponse est déjà dans ton historique.</span>
              </div>
            </>
          ) : null}

          {result?.status === "failed" ? <div className="bx-feedback">{result.error}</div> : null}
        </Card>
      </div>

      <div className="bx-col">
        <Card title="Le protocole">
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">01</span>
            <span className="bx-task-title">Récupère — écris ce qui revient sans aide.</span>
          </div>
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">02</span>
            <span className="bx-task-title">Transfère — applique l&apos;idée à une situation nouvelle.</span>
          </div>
          <div className="bx-task bx-task-idle">
            <span className="bx-task-meta">03</span>
            <span className="bx-task-title">Répare — compare, corrige, puis réexplique.</span>
          </div>
        </Card>

        <Card title="Points de contrôle">
          {showReference ? (
            <ul className="bx-list">
              {lesson.keyTakeaways.map((item) => <li key={item}><span>{item}</span></li>)}
            </ul>
          ) : (
            <p className="bx-muted">
              Fais d&apos;abord un effort réel. Même une mauvaise première réponse produit un meilleur signal
              d&apos;apprentissage qu&apos;une relecture.
            </p>
          )}
          <button type="button" className="bx-link" onClick={() => setShowReference((current) => !current)}>
            {showReference ? "Masquer la référence" : "Comparer avec les idées clés →"}
          </button>
        </Card>

        {history.length > 0 ? (
          <Card title="Historique" right={`${history.length} réponses`}>
            {history.slice(0, 6).map((entry) => (
              <div key={entry.id} className="bx-row">
                <span className="bx-row-icon" aria-hidden="true">✎</span>
                <span className="bx-row-body">
                  <span className="bx-row-title">{entry.answer.split(/\s+/).length} mots</span>
                  <span className="bx-row-meta">
                    {formatDate(entry.createdAt)} · {entry.feedback ? "corrigé" : "en attente"}
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
