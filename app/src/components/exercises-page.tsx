"use client";

import { useEffect, useState, type FormEvent } from "react";

import { subjectById } from "@/lib/curriculum";
import { formatDateTime } from "@/lib/format";
import { useStudy } from "./study-context";
import { Win } from "./window";

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
      // Le presse-papiers peut être refusé (contexte non sécurisé) : le prompt
      // reste affiché et sélectionnable, rien n'est perdu.
    }
  }

  return (
    <>
      <div className="bx-page-head">
        <div>
          <p className="bx-overline">Espace exercices</p>
          <h1>Prouve que tu as compris.</h1>
        </div>
        <p className="bx-page-intro">
          L&apos;exercice suit la leçon du jour. La référence n&apos;apparaît qu&apos;après ton premier effort.
        </p>
      </div>

      <div className="bx-split">
        <div className="bx-stack">
          <Win title={`Question du jour · ${subject.title}`}>
            <h2 style={{ fontSize: 17, lineHeight: 1.4 }}>{lesson.prompt}</h2>

            <form onSubmit={submit} className="bx-stack">
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

              <div className="bx-row-between">
                <button type="submit" className="bx-btn bx-btn-accent" disabled={status === "sending" || wordCount < 20}>
                  {status === "sending" ? "Correction en cours…" : "Faire corriger"}
                </button>
                <span className="bx-muted">
                  {wordCount} mot{wordCount > 1 ? "s" : ""}
                  {wordCount < 20 ? ` · ${20 - wordCount} avant de pouvoir envoyer` : ""}
                </span>
              </div>
            </form>

            {result?.status === "completed" ? (
              <div className="bx-feedback">{result.feedback}</div>
            ) : null}

            {result?.status === "manual" ? (
              <div className="bx-stack">
                <div className="bx-proof">
                  <strong>Aucune clé API n&apos;est configurée — c&apos;est voulu.</strong>
                  <p>{result.hint}</p>
                </div>
                <pre className="bx-code">{result.prompt}</pre>
                <div className="bx-row">
                  <button type="button" className="bx-btn bx-btn-accent" onClick={copyPrompt}>
                    {copied ? "Copié" : "Copier le prompt"}
                  </button>
                  <span className="bx-muted">Ta réponse est déjà enregistrée dans ton historique.</span>
                </div>
              </div>
            ) : null}

            {result?.status === "failed" ? (
              <div className="bx-feedback" style={{ borderLeftColor: "var(--brick)" }}>{result.error}</div>
            ) : null}
          </Win>

          {history.length > 0 ? (
            <Win title="Historique" right={`${history.length} réponses`}>
              <ol className="bx-sequence">
                {history.slice(0, 6).map((entry) => (
                  <li key={entry.id}>
                    <time>{formatDateTime(entry.createdAt).split(" ")[0]}</time>
                    <div>
                      <strong>{entry.answer.split(/\s+/).length} mots</strong>
                      <p>{entry.feedback ? "Corrigé" : "En attente de correction"}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Win>
          ) : null}
        </div>

        <div className="bx-stack">
          <Win title="Le protocole">
            <ol className="bx-ordered">
              <li><div><strong>Récupère</strong><span>Écris ce qui revient sans aide.</span></div></li>
              <li><div><strong>Transfère</strong><span>Applique l&apos;idée à une situation nouvelle.</span></div></li>
              <li><div><strong>Répare</strong><span>Compare, corrige, puis réexplique.</span></div></li>
            </ol>
          </Win>

          <Win title="Points de contrôle">
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
            <button type="button" className="bx-link-action" onClick={() => setShowReference((current) => !current)}>
              {showReference ? "Masquer la référence" : "Comparer avec les idées clés"}
            </button>
          </Win>
        </div>
      </div>
    </>
  );
}
