"use client";

// L'état de la session en cours : durée choisie, chronomètre, matière active,
// notes. Vit au-dessus des pages pour que le timer survive à la navigation —
// changer d'onglet ne doit pas remettre la session à zéro.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { subjects } from "@/lib/curriculum";
import { studyDurations } from "@/lib/study-plan";

type ApiState = "checking" | "ok" | "down";

type StudyValue = {
  duration: number;
  selectedSubjectId: string;
  secondsRemaining: number;
  isRunning: boolean;
  notes: Record<string, string>;
  apiState: ApiState;
  aiLabel: string;
  storageDriver: string;
  chooseDuration: (minutes: number) => void;
  selectSubject: (subjectId: string) => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  setNote: (subjectId: string, value: string) => void;
};

const StudyContext = createContext<StudyValue | null>(null);
const PREFS_KEY = "bizos-learning:preferences";

export function StudyProvider({ children, defaultMinutes = 30 }: { children: ReactNode; defaultMinutes?: number }) {
  const [duration, setDuration] = useState(defaultMinutes);
  const [selectedSubjectId, setSelectedSubjectId] = useState(subjects[0].id);
  const [secondsRemaining, setSecondsRemaining] = useState(defaultMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [apiState, setApiState] = useState<ApiState>("checking");
  const [aiLabel, setAiLabel] = useState("—");
  const [storageDriver, setStorageDriver] = useState("file");

  const saveTimers = useRef(new Map<string, number>());

  useEffect(() => {
    try {
      const prefs = JSON.parse(window.localStorage.getItem(PREFS_KEY) ?? "{}") as {
        duration?: number;
        selectedSubjectId?: string;
      };
      if (prefs.duration && (studyDurations as readonly number[]).includes(prefs.duration)) {
        setDuration(prefs.duration);
        setSecondsRemaining(prefs.duration * 60);
      }
      if (prefs.selectedSubjectId && subjects.some((s) => s.id === prefs.selectedSubjectId)) {
        setSelectedSubjectId(prefs.selectedSubjectId);
      }
    } catch {
      // Préférences illisibles : on garde les valeurs par défaut.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(PREFS_KEY, JSON.stringify({ duration, selectedSubjectId }));
    } catch {
      // Stockage indisponible : la session reste utilisable.
    }
  }, [duration, selectedSubjectId]);

  // Les notes vivent côté serveur : c'est ce qui les rend disponibles depuis un
  // autre appareil quand on branche Postgres.
  useEffect(() => {
    fetch("/api/notes", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((body: Record<string, string>) => setNotes(body))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = window.setInterval(() => {
      setSecondsRemaining((current) => {
        if (current <= 1) {
          setIsRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    let active = true;
    async function check() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const body = await response.json() as {
          ok?: boolean;
          ai?: { label?: string };
          storage?: { driver?: string };
        };
        if (!active) return;
        setApiState(response.ok && body.ok ? "ok" : "down");
        setAiLabel(body.ai?.label ?? "—");
        setStorageDriver(body.storage?.driver ?? "file");
      } catch {
        if (active) setApiState("down");
      }
    }
    void check();
    const interval = window.setInterval(check, 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Une frappe = une requête serait absurde ; on attend 700 ms de silence.
  const setNote = useCallback((subjectId: string, value: string) => {
    setNotes((current) => ({ ...current, [subjectId]: value }));

    const timers = saveTimers.current;
    const pending = timers.get(subjectId);
    if (pending) window.clearTimeout(pending);

    timers.set(subjectId, window.setTimeout(() => {
      void fetch("/api/notes", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subjectId, body: value }),
      }).catch(() => undefined);
      timers.delete(subjectId);
    }, 700));
  }, []);

  const value = useMemo<StudyValue>(() => ({
    duration,
    selectedSubjectId,
    secondsRemaining,
    isRunning,
    notes,
    apiState,
    aiLabel,
    storageDriver,
    chooseDuration(minutes) {
      setDuration(minutes);
      setSecondsRemaining(minutes * 60);
      setIsRunning(false);
    },
    selectSubject: setSelectedSubjectId,
    toggleTimer() {
      // Un chrono à zéro qu'on relance repart pour une session complète : c'est
      // ce que veut dire « Recommencer ».
      if (secondsRemaining === 0) {
        setSecondsRemaining(duration * 60);
        setIsRunning(true);
        return;
      }
      setIsRunning((current) => !current);
    },
    resetTimer() {
      setSecondsRemaining(duration * 60);
      setIsRunning(false);
    },
    setNote,
  }), [aiLabel, apiState, duration, isRunning, notes, secondsRemaining, selectedSubjectId, setNote, storageDriver]);

  return <StudyContext.Provider value={value}>{children}</StudyContext.Provider>;
}

export function useStudy() {
  const context = useContext(StudyContext);
  if (!context) throw new Error("useStudy doit être utilisé dans StudyProvider");
  return context;
}
