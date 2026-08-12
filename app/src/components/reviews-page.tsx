"use client";

import { useEffect, useState } from "react";

import type { ReviewCard } from "@/lib/curriculum";
import type { LocaleKey } from "@/lib/i18n";
import type { RewardGrant } from "@/lib/rewards";
import { previewInterval, type CardState, type ReviewGrade } from "@/lib/scheduler";
import { useCurriculum } from "./curriculum-context";
import { useLocale } from "./locale-context";
import { useRewards } from "./rewards-context";
import { Card } from "./window";

type DueCard = ReviewCard & { state: CardState };
type Queue = { due: DueCard[]; total: number; upcoming: { date: string; count: number }[] };

const GRADES: ReviewGrade[] = [0, 1, 2, 3];

export function ReviewsPage() {
  const { revision } = useCurriculum();
  return <ReviewsSession key={revision} />;
}

function ReviewsSession() {
  const { curriculum } = useCurriculum();
  const { locale, t } = useLocale();
  const { recordGrant } = useRewards();
  const subjects = curriculum.subjects;
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

    setLastInterval(previewInterval(card.state, value, locale));
    setReviewed((current) => current + 1);
    setShowBack(false);
    setIndex((current) => current + 1);

    // Envoi optimiste : la file avance tout de suite, la note se persiste en
    // arrière-plan. Une révision ne doit jamais attendre le réseau.
    const eventId = crypto.randomUUID();
    void fetch("/api/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: card.id, grade: value, eventId }),
    }).then(async (response) => {
      if (!response.ok) return;
      const body = await response.json() as { reward?: RewardGrant | null };
      recordGrant(body.reward);
    }).catch(() => undefined);
  }

  if (!queue) {
    return (
      <div className="bx-col bx-col-full">
        <div className="bx-loader" role="status">{t("reviews.loading")}</div>
      </div>
    );
  }

  const card = queue.due[index];
  const done = !card;
  const maxUpcoming = Math.max(1, ...queue.upcoming.map((day) => day.count));

  return (
    <>
      <div className="bx-col bx-col-wide">
        <Card title={t("reviews.todayQueue")} right={lastInterval ? t("reviews.previous", { interval: lastInterval }) : t("reviews.due", { count: queue.due.length })}>
          <div className="bx-page-head">
            <p className="bx-overline">{t("reviews.space")}</p>
            <h1>{t("reviews.title")}</h1>
          </div>

          {done ? (
            <>
              <div className="bx-metric">
                <span className="bx-metric-value">{reviewed}</span>
                <span className="bx-metric-label">{reviewed > 0 ? t("reviews.reviewed") : t("reviews.nothing")}</span>
              </div>
              <p className="bx-muted">
                {reviewed > 0
                  ? t("reviews.finished")
                  : t("reviews.empty")}
              </p>
            </>
          ) : (
            <>
              <button type="button" className="bx-flashcard" onClick={() => setShowBack((current) => !current)}>
                <span>{card.type}</span>
                <strong>{showBack ? card.back : card.front}</strong>
                <small>
                  {showBack
                    ? t("reviews.rate")
                    : t("reviews.flip")}
                </small>
              </button>

              {showBack ? (
                <div className="bx-grades">
                  {GRADES.map((value) => (
                    <button key={value} type="button" className="bx-btn" onClick={() => void grade(value)}>
                      {t((["reviews.grade.again", "reviews.grade.hard", "reviews.grade.good", "reviews.grade.easy"] as LocaleKey[])[value])}
                      <small>{previewInterval(card.state, value, locale)}</small>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="bx-muted">
                  {t("reviews.position", { current: index + 1, total: queue.due.length, reviews: card.state.totalReviews })}
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="bx-col">
        <Card title={t("reviews.why")}>
          <p style={{ fontSize: "0.95rem", fontWeight: 700 }}>{t("reviews.effort")}</p>
          <p className="bx-muted">
            {t("reviews.explanation")}
          </p>
        </Card>

        <Card title={t("reviews.nextSeven")}>
          {queue.upcoming.map((day) => (
            <div className="bx-stat" key={day.date}>
              <span>
                {new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { weekday: "short", day: "numeric" }).format(new Date(`${day.date}T00:00:00`))}
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

        <Card title={t("reviews.coverage")} right={t("common.cards", { count: queue.total })}>
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
