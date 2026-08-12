import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  applyReward,
  createInitialRewardState,
  type RewardEvent,
  type RewardResult,
  type RewardState,
} from '@/lib/rewards';
import { publishPersistedReward } from '@/lib/reward-persistence';

const rewardsStorageKey = 'scio:rewards';

type RewardNotice = {
  id: string;
  type: RewardEvent['type'];
  xp: number;
  milestoneIds: string[];
};

type RewardsContextValue = {
  state: RewardState;
  ready: boolean;
  notice: RewardNotice | null;
  clearNotice: () => void;
  grant: (event: RewardEvent) => Promise<RewardResult>;
};

const RewardsContext = createContext<RewardsContextValue | null>(null);

function isRewardState(value: unknown): value is RewardState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RewardState>;
  return (
    typeof candidate.xp === 'number' &&
    typeof candidate.mastery === 'number' &&
    !!candidate.streak &&
    typeof candidate.streak.count === 'number' &&
    Array.isArray(candidate.processedEventIds) &&
    Array.isArray(candidate.unlockedMilestoneIds)
  );
}

export function RewardsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState(createInitialRewardState);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState<RewardNotice | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(rewardsStorageKey)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const parsed: unknown = JSON.parse(stored);
          if (isRewardState(parsed)) {
            stateRef.current = parsed;
            setState(parsed);
          }
        } catch {
          // A damaged local value is ignored; learning progress remains usable.
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const grant = useCallback(async (event: RewardEvent) => {
    const result = applyReward(stateRef.current, event);
    if (!result.gained) return result;

    await publishPersistedReward(
      result,
      async ({ state: nextState }) => {
        await AsyncStorage.setItem(rewardsStorageKey, JSON.stringify(nextState));
      },
      ({ state: nextState, xpGained, newMilestoneIds }) => {
        stateRef.current = nextState;
        setState(nextState);
        setNotice({
          id: event.eventId,
          type: event.type,
          xp: xpGained,
          milestoneIds: newMilestoneIds,
        });
      },
    );
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    return result;
  }, []);

  const value = useMemo(
    () => ({ state, ready, notice, clearNotice, grant }),
    [clearNotice, grant, notice, ready, state],
  );

  return <RewardsContext.Provider value={value}>{children}</RewardsContext.Provider>;
}

export function useRewards(): RewardsContextValue {
  const context = useContext(RewardsContext);
  if (!context) {
    throw new Error('useRewards must be used inside RewardsProvider');
  }
  return context;
}
