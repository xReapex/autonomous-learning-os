"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { emptyRewardState, type RewardGrant, type RewardState, type RewardTierId } from "@/lib/rewards";
import { useLocale } from "./locale-context";

type RewardsValue = {
  state: RewardState;
  recordGrant: (grant: RewardGrant | null | undefined) => void;
};

const RewardsContext = createContext<RewardsValue | null>(null);

export function RewardsProvider({ children }: { children: ReactNode }) {
  const { t } = useLocale();
  const [state, setState] = useState<RewardState>(emptyRewardState);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/rewards", { cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<RewardState> : null)
      .then((body) => { if (active && body) setState(body); })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);

  const recordGrant = useCallback((grant: RewardGrant | null | undefined) => {
    if (!grant) return;
    setState(grant.state);
    if (!grant.awarded) return;
    const eventCopy = grant.kind === "lesson_completed"
      ? t("rewards.lesson")
      : grant.kind === "exercise_succeeded"
        ? t("rewards.exercise")
        : t("rewards.review");
    const tierCopy = grant.tierUnlocked
      ? ` ${t("rewards.tierUnlocked", { tier: t(`rewards.tier.${grant.tierUnlocked}` as `rewards.tier.${RewardTierId}`) })}`
      : "";
    setFeedback(`${eventCopy} ${t("rewards.gained", grant.reward)}${tierCopy}`);
  }, [t]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 5_000);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const value = useMemo(() => ({ state, recordGrant }), [recordGrant, state]);
  return (
    <RewardsContext.Provider value={value}>
      {children}
      {feedback ? <div className="bx-reward-feedback" role="status" aria-live="polite">{feedback}</div> : null}
    </RewardsContext.Provider>
  );
}

export function useRewards(): RewardsValue {
  const value = useContext(RewardsContext);
  if (!value) throw new Error("useRewards must be used inside RewardsProvider");
  return value;
}

export function RewardSummary({ compact = false }: { compact?: boolean }) {
  const { state } = useRewards();
  const { t } = useLocale();
  return (
    <div className={compact ? "bx-rewards is-compact" : "bx-rewards"} aria-label={t("rewards.summary")}>
      <span><strong>{state.totalXp}</strong> {t("rewards.xp")}</span>
      <span><strong>{state.masteryPoints}</strong> {t("rewards.mastery")}</span>
      <span><strong>{state.streak.current}</strong> {t("rewards.streak")}</span>
      {!compact ? (
        <small>
          {t(`rewards.tier.${state.tier.id}` as `rewards.tier.${RewardTierId}`)} · {t("rewards.masteryLevel", { level: state.masteryLevel })} · {state.tier.nextTierAt === null ? t("rewards.maxTier") : t("rewards.nextTier", { xp: state.tier.nextTierAt })}
        </small>
      ) : null}
    </div>
  );
}
