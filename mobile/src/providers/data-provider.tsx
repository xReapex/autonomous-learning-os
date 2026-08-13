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
import {
  clearAuthoritativeCache,
  readAuthoritativeCacheState,
  serializeActiveCache,
  serializeEmptyCache,
} from '@/lib/authoritative-data-cache';
import { runCoordinatedSync } from '@/lib/coordinated-sync';
import { fetchConsistentDataSnapshot } from '@/lib/consistent-data-snapshot';
import { createDataOperationCoordinator } from '@/lib/data-operation-coordinator';
import { removeCurriculumDurably } from '@/lib/curriculum-removal';
import { commitOperationFailure } from '@/lib/operation-failure';
import { parseScioDataDto } from '@/lib/dto-validation';
import { mutateThenRefresh } from '@/lib/durable-refresh';
import {
  createNote,
  deleteCurriculum as deleteCurriculumRequest,
  getApiConfiguration,
  getCards,
  getCurriculumSnapshot,
  getProgress,
  mutateCard,
  mutateProgress,
  replaceCurriculum,
  type NoteMutation,
} from '@/services/api';
import type { ScioData } from '@/types/scio';

type DataStatus = 'loading' | 'ready' | 'empty' | 'offline' | 'error';
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
  removeActiveCurriculum: () => Promise<boolean>;
};

const dataCacheKey = 'scio:data-cache';
const DataContext = createContext<DataContextValue | null>(null);

async function readCache() {
  return readAuthoritativeCacheState({
    readData: () => AsyncStorage.getItem(dataCacheKey),
    parse: parseScioDataDto,
  });
}

async function writeActiveCache(data: ScioData): Promise<void> {
  await AsyncStorage.setItem(dataCacheKey, serializeActiveCache(data));
}

async function fetchAuthoritativeData(baseUrl: string) {
  return fetchConsistentDataSnapshot({
    getCurriculum: () => getCurriculumSnapshot(baseUrl),
    getCards: () => getCards(baseUrl),
    getProgress: () => getProgress(baseUrl),
  });
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
  const operations = useRef(createDataOperationCoordinator());
  const currentData = useRef<ScioData | null>(null);
  const currentCurriculumRevision = useRef<string | null>(null);


  const load = useCallback(() => operations.current.runMutation(async () => {
    const operation = operations.current.start();
    setState((current) => ({ ...current, status: 'loading', errorKey: null }));
    try {
      const configuration = getApiConfiguration();
      const network = await NetInfo.fetch();
      if (network.isConnected === false) {
        const cached = await readCache();
        const cachedData = cached.status === 'ready' ? cached.data : null;
        await operations.current.commit(operation, () => {
          if (mounted.current) {
            currentData.current = cachedData;
            currentCurriculumRevision.current = cached.status === 'ready'
              ? cached.data.curriculumRevision ?? null
              : cached.status === 'empty' ? cached.revision : null;
            setState({
              status: cached.status === 'empty' ? 'empty' : 'offline',
              source: cached.status === 'missing' ? 'api' : 'cache',
              data: cachedData,
              errorKey: 'status.error.network',
            });
          }
          return true;
        });
        return false;
      }

      const snapshot = await fetchAuthoritativeData(configuration.baseUrl);
      if (snapshot.status === 'empty') {
        return operations.current.commitPrepared(
          operation,
          async () => {
            await clearAuthoritativeCache({
              writeEmpty: () => AsyncStorage.setItem(dataCacheKey, serializeEmptyCache(snapshot.revision)),
              removeLegacyData: () => AsyncStorage.removeItem(dataCacheKey),
              publishEmpty: () => undefined,
            });
          },
          () => {
            if (mounted.current) {
              currentData.current = null;
              currentCurriculumRevision.current = snapshot.revision;
              setState({ status: 'empty', source: 'api', data: null, errorKey: null });
            }
            return true;
          },
          async () => { await AsyncStorage.removeItem(dataCacheKey).catch(() => undefined); },
        );
      }
      const data = snapshot.data;
      return operations.current.commitPrepared(
        operation,
        () => writeActiveCache(data),
        () => {
          if (mounted.current) {
            currentData.current = data;
            currentCurriculumRevision.current = data.curriculumRevision ?? null;
            setState({ status: 'ready', source: 'api', data, errorKey: null });
          }
          return true;
        },
        async () => { await AsyncStorage.removeItem(dataCacheKey).catch(() => undefined); },
      );
    } catch (error) {
      if (!operations.current.isCurrent(operation)) return false;
      const cached = await readCache();
      const cachedData = cached.status === 'ready' ? cached.data : null;
      const failure = dataFailureState(error);
      await operations.current.commit(operation, () => {
        if (mounted.current) {
          currentData.current = cachedData;
          currentCurriculumRevision.current = cached.status === 'ready'
            ? cached.data.curriculumRevision ?? null
            : cached.status === 'empty' ? cached.revision : null;
          setState({
            status: failure.status,
            source: cached.status === 'missing' ? 'api' : 'cache',
            data: cachedData,
            errorKey: failure.errorKey,
          });
        }
        return true;
      });
      return false;
    }
  }), []);

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
    const validated = parseScioDataDto(candidate);
    const configuration = getApiConfiguration();
    return operations.current.runMutation(async () => {
      const operation = operations.current.start();
      try {
        const current = await getCurriculumSnapshot(configuration.baseUrl);
        await replaceCurriculum(configuration.baseUrl, validated, current.revision);
        const snapshot = await fetchAuthoritativeData(configuration.baseUrl);
        if (snapshot.status !== 'ready') throw new Error('curriculum_missing_after_activation');
        const data = snapshot.data;
        await operations.current.commitPrepared(
          operation,
          () => writeActiveCache(data),
          () => {
            if (mounted.current) {
              currentData.current = data;
              currentCurriculumRevision.current = data.curriculumRevision ?? null;
              setState({ status: 'ready', source: 'api', data, errorKey: null });
            }
            return true;
          },
          async () => { await AsyncStorage.removeItem(dataCacheKey).catch(() => undefined); },
        );
        return { ok: true } as const;
      } catch (error) {
        const failure = dataFailureState(error);
        await commitOperationFailure(operations.current, operation, () => {
          if (mounted.current) setState((current) => ({ ...current, ...failure }));
        });
        return { ok: false, code: activationErrorCode(error) } as const;
      }
    });
  }, []);

  const sync = useCallback(async (
    operation: (baseUrl: string, curriculumRevision: string) => Promise<void>,
  ) => {
    const configuration = getApiConfiguration();
    return runCoordinatedSync({
      coordinator: operations.current,
      mutate: async () => {
        const curriculumRevision = currentCurriculumRevision.current;
        if (!curriculumRevision) throw new Error('curriculum_revision_missing');
        await operation(configuration.baseUrl, curriculumRevision);
      },
      onFailure: (error) => {
        const failure = dataFailureState(error);
        if (mounted.current) setState((current) => ({ ...current, ...failure }));
      },
    });
  }, []);

  const mutateAndRefresh = useCallback(async (
    operation: (baseUrl: string, curriculumRevision: string) => Promise<void>,
  ) => {
    const result = await mutateThenRefresh(
      () => sync(operation),
      load,
    );
    return result.durable;
  }, [load, sync]);

  const completeLesson = useCallback(
    (lessonId: string, eventId: string) => mutateAndRefresh((baseUrl, revision) =>
      mutateProgress(baseUrl, { eventId, lessonId, status: 'completed' }, revision),
    ),
    [mutateAndRefresh],
  );

  const passExercise = useCallback(
    (exerciseId: string, eventId: string) => mutateAndRefresh((baseUrl, revision) =>
      mutateProgress(baseUrl, { eventId, exerciseId, status: 'passed' }, revision),
    ),
    [mutateAndRefresh],
  );

  const reviewCard = useCallback(
    (cardId: string, eventId: string, recalled: boolean) => mutateAndRefresh((baseUrl, revision) =>
      mutateCard(baseUrl, { eventId, cardId, result: recalled ? 'recalled' : 'again' }, revision),
    ),
    [mutateAndRefresh],
  );

  const saveNote = useCallback(
    (note: NoteMutation) => sync((baseUrl, revision) => createNote(baseUrl, note, revision)),
    [sync],
  );

  const removeActiveCurriculum = useCallback(async () => {
    const configuration = getApiConfiguration();
    return operations.current.runMutation(async () => {
      const operation = operations.current.start();
      try {
        await removeCurriculumDurably({
          removeRemote: async () => {
            const curriculumRevision = currentCurriculumRevision.current;
            if (!curriculumRevision) throw new Error('curriculum_revision_missing');
            return deleteCurriculumRequest(configuration.baseUrl, curriculumRevision);
          },
          removeCache: async (emptyRevision) => {
            await operations.current.commitPrepared(
              operation,
              async () => {
                await clearAuthoritativeCache({
                  writeEmpty: () => AsyncStorage.setItem(dataCacheKey, serializeEmptyCache(emptyRevision)),
                  removeLegacyData: () => AsyncStorage.removeItem(dataCacheKey),
                  publishEmpty: () => undefined,
                });
              },
              () => {
                if (mounted.current) {
                  currentData.current = null;
                  currentCurriculumRevision.current = emptyRevision;
                  setState({ status: 'empty', source: 'api', data: null, errorKey: null });
                }
                return true;
              },
              async () => { await AsyncStorage.removeItem(dataCacheKey).catch(() => undefined); },
            );
          },
        });
        return true;
      } catch (error) {
        const failure = dataFailureState(error);
        await commitOperationFailure(operations.current, operation, () => {
          if (mounted.current) setState((current) => ({ ...current, ...failure }));
        });
        return false;
      }
    });
  }, []);

  const value = useMemo<DataContextValue>(
    () => ({
      ...state,
      activateGeneratedCurriculum,
      retry: async () => { await load(); },
      completeLesson,
      passExercise,
      reviewCard,
      saveNote,
      removeActiveCurriculum,
    }),
    [activateGeneratedCurriculum, completeLesson, load, passExercise, removeActiveCurriculum, reviewCard, saveNote, state],
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
