import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { TranslationKey } from '@/lib/i18n';
import {
  activationErrorCode,
  dataFailureState,
  type ActivationErrorCode,
} from '@/lib/data-provider-errors';
import { parseScioDataDto } from '@/lib/dto-validation';
import { mutateThenRefresh } from '@/lib/durable-refresh';
import {
  createNote,
  getApiConfiguration,
  getCards,
  getCurriculum,
  getProgress,
  mutateCard,
  mutateProgress,
  replaceCurriculum,
  type NoteMutation,
} from '@/services/api';
import type { ScioData } from '@/types/scio';

type DataStatus = 'loading' | 'ready' | 'offline' | 'error';
type DataSource = 'generated' | 'api' | 'cache';

type DataState = {
  status: DataStatus;
  source: DataSource;
  data: ScioData | null;
  errorKey: TranslationKey | null;
};

type DataContextValue = DataState & {
  activateGeneratedCurriculum: (data: ScioData) => Promise<
    { ok: true } | { ok: false; code: ActivationErrorCode }
  >;
  retry: () => Promise<void>;
  completeLesson: (lessonId: string, eventId: string) => Promise<boolean>;
  passExercise: (exerciseId: string, eventId: string) => Promise<boolean>;
  reviewCard: (cardId: string, eventId: string, recalled: boolean) => Promise<boolean>;
  saveNote: (note: NoteMutation) => Promise<boolean>;
};

const dataCacheKey = 'scio:data-cache';
const DataContext = createContext<DataContextValue | null>(null);

async function readCache(): Promise<ScioData | null> {
  const stored = await AsyncStorage.getItem(dataCacheKey).catch(() => null);
  if (!stored) return null;
  try {
    return parseScioDataDto(JSON.parse(stored));
  } catch {
    return null;
  }
}

async function fetchAuthoritativeData(baseUrl: string): Promise<ScioData> {
  const [curriculum, cardPayload, progress] = await Promise.all([
    getCurriculum(baseUrl),
    getCards(baseUrl),
    getProgress(baseUrl),
  ]);
  return {
    curriculum,
    cards: Array.isArray(cardPayload) ? cardPayload : cardPayload.cards,
    exercises:
      (!Array.isArray(cardPayload) ? cardPayload.exercises : undefined) ??
      curriculum.exercises ??
      [],
    progress,
  };
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DataState>({
    status: 'loading',
    source: 'api',
    data: null,
    errorKey: null,
  });
  const mounted = useRef(true);
  const lastConnection = useRef<boolean | null>(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: 'loading', errorKey: null }));
    try {
      const configuration = getApiConfiguration();
      const network = await NetInfo.fetch();
      if (network.isConnected === false) {
        const cached = await readCache();
        if (mounted.current) {
          setState({
            status: 'offline',
            source: cached ? 'cache' : 'api',
            data: cached,
            errorKey: 'status.error.network',
          });
        }
        return false;
      }

      const data = await fetchAuthoritativeData(configuration.baseUrl);
      await AsyncStorage.setItem(dataCacheKey, JSON.stringify(data));
      if (mounted.current) {
        setState({ status: 'ready', source: 'api', data, errorKey: null });
      }
      return true;
    } catch (error) {
      const cached = await readCache();
      const failure = dataFailureState(error);
      if (mounted.current) {
        setState({
          status: failure.status,
          source: cached ? 'cache' : 'api',
          data: cached,
          errorKey: failure.errorKey,
        });
      }
      return false;
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const initialLoad = setTimeout(() => void load(), 0);
    const unsubscribe = NetInfo.addEventListener((network) => {
      const reconnected = lastConnection.current === false && network.isConnected === true;
      lastConnection.current = network.isConnected;
      if (network.isConnected === false) {
        setState((current) =>
          current.data ? { ...current, status: 'offline', errorKey: 'status.error.network' } : current,
        );
      } else if (reconnected) {
        void load();
      }
    });
    return () => {
      mounted.current = false;
      clearTimeout(initialLoad);
      unsubscribe();
    };
  }, [load]);

  const activateGeneratedCurriculum = useCallback(async (candidate: ScioData) => {
    try {
      const validated = parseScioDataDto(candidate);
      const configuration = getApiConfiguration();
      await replaceCurriculum(configuration.baseUrl, validated);
      const data = await fetchAuthoritativeData(configuration.baseUrl);
      await AsyncStorage.setItem(dataCacheKey, JSON.stringify(data));
      if (mounted.current) {
        setState({ status: 'ready', source: 'api', data, errorKey: null });
      }
      return { ok: true } as const;
    } catch (error) {
      const failure = dataFailureState(error);
      if (mounted.current) {
        setState((current) => ({ ...current, ...failure }));
      }
      return { ok: false, code: activationErrorCode(error) } as const;
    }
  }, []);

  const sync = useCallback(async (operation: (baseUrl: string) => Promise<void>) => {
    const configuration = getApiConfiguration();
    try {
      await operation(configuration.baseUrl);
      return true;
    } catch (error) {
      const failure = dataFailureState(error);
      setState((current) => ({ ...current, ...failure }));
      return false;
    }
  }, []);

  const mutateAndRefresh = useCallback(async (operation: (baseUrl: string) => Promise<void>) => {
    const result = await mutateThenRefresh(
      () => sync(operation),
      load,
    );
    return result.durable;
  }, [load, sync]);

  const completeLesson = useCallback(
    (lessonId: string, eventId: string) => mutateAndRefresh((baseUrl) =>
      mutateProgress(baseUrl, { eventId, lessonId, status: 'completed' }),
    ),
    [mutateAndRefresh],
  );

  const passExercise = useCallback(
    (exerciseId: string, eventId: string) => mutateAndRefresh((baseUrl) =>
      mutateProgress(baseUrl, { eventId, exerciseId, status: 'passed' }),
    ),
    [mutateAndRefresh],
  );

  const reviewCard = useCallback(
    (cardId: string, eventId: string, recalled: boolean) => mutateAndRefresh((baseUrl) =>
      mutateCard(baseUrl, { eventId, cardId, result: recalled ? 'recalled' : 'again' }),
    ),
    [mutateAndRefresh],
  );

  const saveNote = useCallback(
    (note: NoteMutation) => sync((baseUrl) => createNote(baseUrl, note)),
    [sync],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      activateGeneratedCurriculum,
      retry: async () => { await load(); },
      completeLesson,
      passExercise,
      reviewCard,
      saveNote,
    }),
    [activateGeneratedCurriculum, completeLesson, load, passExercise, reviewCard, saveNote, state],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useScioData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useScioData must be used inside DataProvider');
  }
  return context;
}
