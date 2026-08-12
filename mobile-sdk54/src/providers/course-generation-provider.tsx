import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from 'react';

import {
  courseGenerationReducer,
  idleCourseGeneration,
  type CourseGenerationState,
} from '@/lib/course-generation-state';
import { startDurableGeneration } from '@/lib/generation-job-creation';
import {
  acknowledgeGenerationJob,
  cancelGenerationJob,
  createGenerationJob,
  getGenerationJob,
  resolveGenerationJob,
  type GenerationJob,
} from '@/lib/generation-job-api';
import { finalizeGenerationJob } from '@/lib/generation-job-lifecycle';
import {
  generationJobStorageKey,
  parseGenerationJobJournal,
  serializeAttachedGenerationJob,
  serializeCreatingGenerationJob,
  type GenerationJobPointer,
} from '@/lib/generation-job-pointer';
import { pollGenerationJob } from '@/lib/generation-job-poller';
import { EngineApiError } from '@/lib/engine-api';
import { convertGeneratedCurriculum } from '@/lib/generated-curriculum';
import type { Locale } from '@/lib/i18n';

export type CourseGenerationContextValue = {
  state: CourseGenerationState;
  start: (stateToken: string, locale: Locale) => boolean;
  retry: () => boolean;
  clear: () => void;
};

const CourseGenerationContext = createContext<CourseGenerationContextValue | null>(null);

function requestId(): string {
  const random = Math.random().toString(36).slice(2, 14);
  return `generation-${Date.now()}-${random}`;
}

const removeLocalJournal = () => AsyncStorage.removeItem(generationJobStorageKey);
const lifecycleDependencies = {
  cancel: cancelGenerationJob,
  acknowledge: acknowledgeGenerationJob,
  removeLocal: removeLocalJournal,
};

export function CourseGenerationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(courseGenerationReducer, idleCourseGeneration);
  const activeRequest = useRef<string | null>(null);
  const generationStateToken = useRef<string | null>(null);
  const pendingCreation = useRef<{ requestId: string; locale: Locale } | null>(null);
  const abandonedRequests = useRef(new Set<string>());
  const cleanupRequests = useRef(new Set<string>());
  const mounted = useRef(true);

  const completeJob = useCallback(async (pointer: GenerationJobPointer, job: GenerationJob) => {
    if (!mounted.current || activeRequest.current !== pointer.requestId) return;
    if (job.status === 'succeeded') {
      if (job.output?.phase !== 'proposal') throw new EngineApiError('invalid');
      dispatch({
        type: 'succeed',
        requestId: pointer.requestId,
        proposal: convertGeneratedCurriculum(job.output.document, pointer.locale),
      });
      return;
    }
    await finalizeGenerationJob(job, lifecycleDependencies);
    if (!mounted.current || activeRequest.current !== pointer.requestId) return;
    dispatch({ type: 'fail', requestId: pointer.requestId, error: 'expired' });
  }, []);

  const follow = useCallback(async (pointer: GenerationJobPointer) => {
    activeRequest.current = pointer.requestId;
    dispatch({ type: 'start', input: { requestId: pointer.requestId, locale: pointer.locale, jobId: pointer.jobId } });
    try {
      const job = await pollGenerationJob(pointer.jobId, {
        get: getGenerationJob,
        isCancelled: () => !mounted.current || activeRequest.current !== pointer.requestId,
      });
      if (job) await completeJob(pointer, job);
    } catch (error) {
      if (!mounted.current || activeRequest.current !== pointer.requestId) return;
      dispatch({
        type: 'fail',
        requestId: pointer.requestId,
        error: error instanceof EngineApiError ? error.code : 'network',
      });
    } finally {
      if (activeRequest.current === pointer.requestId) activeRequest.current = null;
    }
  }, [completeJob]);

  const recoverCreating = useCallback(async (input: { requestId: string; locale: Locale }) => {
    if (activeRequest.current) return;
    activeRequest.current = input.requestId;
    pendingCreation.current = input;
    dispatch({ type: 'start', input: { ...input, jobId: null } });
    try {
      const job = await resolveGenerationJob(input.requestId);
      const pointer = { jobId: job.id, ...input } satisfies GenerationJobPointer;
      await AsyncStorage.setItem(generationJobStorageKey, serializeAttachedGenerationJob(pointer));
      if (!mounted.current || activeRequest.current !== input.requestId) return;
      dispatch({ type: 'attach', requestId: input.requestId, jobId: job.id });
      const terminal = job.status === 'queued' || job.status === 'running'
        ? await pollGenerationJob(job.id, {
            get: getGenerationJob,
            isCancelled: () => !mounted.current || activeRequest.current !== input.requestId,
          })
        : job;
      if (terminal) await completeJob(pointer, terminal);
    } catch (error) {
      if (!mounted.current || activeRequest.current !== input.requestId) return;
      const code = error instanceof EngineApiError ? error.code : 'network';
      if (code === 'expired') await removeLocalJournal().catch(() => undefined);
      dispatch({ type: 'fail', requestId: input.requestId, error: code });
    } finally {
      if (activeRequest.current === input.requestId) activeRequest.current = null;
    }
  }, [completeJob]);

  useEffect(() => {
    mounted.current = true;
    void AsyncStorage.getItem(generationJobStorageKey)
      .then((raw) => {
        const journal = parseGenerationJobJournal(raw);
        if (!journal) {
          if (raw) void removeLocalJournal();
          return;
        }
        if (!mounted.current || activeRequest.current) return;
        if (journal.phase === 'creating') void recoverCreating(journal);
        else void follow(journal);
      })
      .catch(() => undefined);
    return () => {
      mounted.current = false;
      activeRequest.current = null;
    };
  }, [follow, recoverCreating]);

  const executeCreation = useCallback((stateToken: string, input: { requestId: string; locale: Locale }) => {
    void startDurableGeneration({ stateToken, ...input }, {
      persistCreating: (creating) => AsyncStorage.setItem(
        generationJobStorageKey,
        serializeCreatingGenerationJob(creating),
      ),
      create: createGenerationJob,
      persistAttached: (pointer) => AsyncStorage.setItem(
        generationJobStorageKey,
        serializeAttachedGenerationJob(pointer),
      ),
    }).then(async (job) => {
      const pointer = { jobId: job.id, ...input } satisfies GenerationJobPointer;
      generationStateToken.current = null;
      pendingCreation.current = null;
      if (abandonedRequests.current.delete(input.requestId)) {
        await finalizeGenerationJob(job, lifecycleDependencies);
        return;
      }
      if (!mounted.current || activeRequest.current !== input.requestId) return;
      dispatch({ type: 'attach', requestId: input.requestId, jobId: job.id });
      const terminal = job.status === 'queued' || job.status === 'running'
        ? await pollGenerationJob(job.id, {
            get: getGenerationJob,
            isCancelled: () => !mounted.current || activeRequest.current !== input.requestId,
          })
        : job;
      if (terminal) await completeJob(pointer, terminal);
    }).catch((error: unknown) => {
      if (!mounted.current || activeRequest.current !== input.requestId) return;
      dispatch({
        type: 'fail',
        requestId: input.requestId,
        error: error instanceof EngineApiError ? error.code : 'network',
      });
    }).finally(() => {
      if (activeRequest.current === input.requestId) activeRequest.current = null;
    });
  }, [completeJob]);

  const launch = useCallback((stateToken: string, locale: Locale) => {
    if (activeRequest.current) return false;
    const input = { requestId: requestId(), locale };
    generationStateToken.current = stateToken;
    pendingCreation.current = input;
    activeRequest.current = input.requestId;
    dispatch({ type: 'start', input: { ...input, jobId: null } });
    executeCreation(stateToken, input);
    return true;
  }, [executeCreation]);

  const start = useCallback((stateToken: string, locale: Locale) => launch(stateToken, locale), [launch]);

  const retry = useCallback(() => {
    if (state.status !== 'error' || state.error === 'expired' || activeRequest.current) return false;
    if (state.input.jobId) {
      void follow({ jobId: state.input.jobId, requestId: state.input.requestId, locale: state.input.locale });
      return true;
    }
    const input = pendingCreation.current ?? { requestId: state.input.requestId, locale: state.input.locale };
    const stateToken = generationStateToken.current;
    if (stateToken) {
      activeRequest.current = input.requestId;
      dispatch({ type: 'start', input: { ...input, jobId: null } });
      executeCreation(stateToken, input);
      return true;
    }
    void recoverCreating(input);
    return true;
  }, [executeCreation, follow, recoverCreating, state]);

  const clear = useCallback(() => {
    if (state.status === 'idle') return;
    const input = state.input;
    if (cleanupRequests.current.has(input.requestId)) return;
    activeRequest.current = null;
    generationStateToken.current = null;
    pendingCreation.current = null;

    const jobId = input.jobId;
    if (!jobId) {
      abandonedRequests.current.add(input.requestId);
      dispatch({ type: 'clear' });
      return;
    }
    if (state.status === 'error' && state.error === 'expired') {
      void removeLocalJournal();
      dispatch({ type: 'clear' });
      return;
    }

    cleanupRequests.current.add(input.requestId);
    void (async () => {
      try {
        const job = state.status === 'ready'
          ? ({ id: jobId, status: 'succeeded' } as const)
          : await getGenerationJob(jobId);
        await finalizeGenerationJob(job, lifecycleDependencies);
        if (mounted.current) dispatch({ type: 'clear' });
      } catch {
        if (mounted.current && state.status === 'running') {
          dispatch({ type: 'fail', requestId: input.requestId, error: 'network' });
        }
      } finally {
        cleanupRequests.current.delete(input.requestId);
      }
    })();
  }, [state]);

  const value = useMemo(() => ({ state, start, retry, clear }), [clear, retry, start, state]);
  return <CourseGenerationContext.Provider value={value}>{children}</CourseGenerationContext.Provider>;
}

export function useCourseGeneration(): CourseGenerationContextValue {
  const context = useContext(CourseGenerationContext);
  if (!context) throw new Error('useCourseGeneration must be used inside CourseGenerationProvider');
  return context;
}
