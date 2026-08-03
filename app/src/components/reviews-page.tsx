"use client";

import { useEffect, useState } from "react";

import type { ReviewCard } from "@/lib/curriculum";
import { subjects } from "@/lib/curriculum";
import { gradeLabels, previewInterval, type CardState, type ReviewGrade } from "@/lib/scheduler";
import { Card } from "./window";

type DueCard = ReviewCard & { state: CardState };
type Queue = { due: DueCard[]; total: number; upcoming: { date: string; count: number }[] };

const GRADES: ReviewGrade[] = [0, 1, 2, 3];

export function ReviewsPage() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [index, setIndex] = useState(0);
  const [showBack, setShowBack] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [lastInterval, setLastInterval] = useState("");

  useEffect(() => {
    fetch("/api/cards", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((body: Queue | null) => setQueue(body))
      .catch(() => setQueue({ due: [], total: 0, upcoming: [] }));
  }, []);

  async function grade(value: ReviewGrade) {
    const card = queue?.due[index];
    if (!card) return;

    setLastInterval(previewInterval(card.state, value));
    setReviewed((current) => current + 1);
    setShowBack(false);
    setIndex((current) => current + 1);

    // Envoi optimiste : la file avance tout de suite, la note se persiste en
    // arrière-plan. Une révision ne doit jamais attendre le réseau.
    void fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, grade: value }),
    }).catch(() => undefined);
  }

  if (!queue) {
    return (
      <div className="bx-col bx-col-full">
        <div className="bx-loader" role="status">Chargement de ta file…</div>
      </div>
    );
  }

  const card = queue.due[index];
  const done = !card;
  const maxUpcoming = Math.max(1, ...queue.upcoming.map((day) => day.count));

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title="File du jour" right={lastInterval ? `précédente ${lastInterval}` : `${queue.due.length} dues`}>
          <div className="bx-page-head">
            <p className="bx-overline">Espace révisions</p>
            <h1>Retrouver, pas reconnaître.</h1>
          </div>

          {done ? (
            <>
              <div className="bx-metric">
                <span className="bx-metric-value">{reviewed}</span>
                <span className="bx-metric-label">{reviewed > 0 ? "cartes révisées" : "rien à réviser"}</span>
              </div>
              <p className="bx-muted">
                {reviewed > 0
                  ? "File terminée. Les prochaines reviendront à leur date d'échéance."
                  : "Aucune carte due aujourd'hui. Reviens demain, ou avance dans le cours pour en créer."}
              </p>
            </>
          ) : (
            <>
              <button type="button" className="bx-flashcard" onClick={() => setShowBack((current) => !current)}>
                <span>{card.type}</span>
                <strong>{showBack ? card.back : card.front}</strong>
                <small>
                  {showBack
                    ? "Évalue la difficulté réelle de la récupération."
                    : "Formule ta réponse à voix haute, puis retourne la carte."}
                </small>
              </button>

              {showBack ? (
                <div className="bx-grades">
                  {GRADES.map((value) => (
                    <button key={value} type="button" className="bx-btn" onClick={() => void grade(value)}>
                      {gradeLabels[value]}
                      <small>{previewInterval(card.state, value)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="bx-muted">
                  Carte {index + 1} sur {queue.due.length} · révisions faites : {card.state.totalReviews}
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="bx-col">
        <Card title="Pourquoi ça marche">
          <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>L&apos;effort de rappel est le signal.</p>
          <p className="bx-muted">
            Relire donne une impression de familiarité. Tenter de répondre mesure l&apos;accès réel à la
            connaissance — et indique quoi réviser ensuite.
          </p>
        </Card>

        <Card title="Sept prochains jours">
          {queue.upcoming.map((day) => (
            <div className="bx-stat" key={day.date}>
              <span>
                {new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" }).format(new Date(`${day.date}T00:00:00`))}
              </span>
              <div style={{ flex: 1, margin: "0 10px" }}>
                <div className="bx-meter">
                  <span style={{ width: `${(day.count / maxUpcoming) * 100}%` }} />
                </div>
              </div>
              <strong>{day.count}</strong>
            </div>
          ))}
        </Card>

        <Card title="Couverture" right={`${queue.total} cartes`}>
          <ul className="bx-list">
            {subjects.map((subject) => (
              <li key={subject.id}>
                <span>{subject.icon} {subject.title}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
