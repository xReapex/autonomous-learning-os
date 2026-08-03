"use client";

// L'état du bureau : quel fond, à quelle opacité.
//
// Persisté en localStorage plutôt qu'en base : c'est une préférence d'affichage
// propre à l'appareil, pas une donnée d'apprentissage. Changer de fond sur le
// portable n'a aucune raison de changer celui du poste fixe.

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import {
  DEFAULT_DIM,
  DEFAULT_WALLPAPER_ID,
  isDarkWallpaper,
  resolveWallpaper,
  type Wallpaper,
} from "@/lib/wallpapers";

type WallpaperValue = {
  wallpaper: Wallpaper;
  id: string;
  dim: number;
  /** Fichiers déposés par l'utilisateur dans public/wallpapers/. */
  customFiles: string[];
  setWallpaper: (id: string) => void;
  setDim: (dim: number) => void;
  reset: () => void;
};

const WallpaperContext = createContext<WallpaperValue | null>(null);
const STORAGE_KEY = "bizos-learning:wallpaper";

export function WallpaperProvider({
  children,
  defaultId = DEFAULT_WALLPAPER_ID,
}: {
  children: ReactNode;
  defaultId?: string;
}) {
  const [id, setId] = useState(defaultId);
  // L'opacité de départ est celle que le fond choisi rend lisible, pas une
  // constante globale : un aplat s'affiche à 100 %, un motif dense beaucoup moins.
  const [dim, setDimState] = useState(() => resolveWallpaper(defaultId).suggestedDim ?? DEFAULT_DIM);
  const [customFiles, setCustomFiles] = useState<string[]>([]);

  // La lecture du localStorage est différée à l'effet : la lire au rendu
  // produirait un HTML serveur différent du premier rendu client (hydratation).
  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as {
        id?: string;
        dim?: number;
      };
      if (stored.id) setId(stored.id);
      if (typeof stored.dim === "number") setDimState(stored.dim);
    } catch {
      // Une préférence corrompue ne doit pas empêcher d'ouvrir l'app.
    }
  }, []);

  useEffect(() => {
    fetch("/api/wallpapers", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { files: [] }))
      .then((body: { files?: string[] }) => setCustomFiles(body.files ?? []))
      .catch(() => setCustomFiles([]));
  }, []);

  const wallpaper = useMemo(() => resolveWallpaper(id), [id]);

  // Un fond sombre bascule tout le jeu de tokens : sans ça, l'encre navy sur du
  // navy devient illisible.
  useEffect(() => {
    document.documentElement.dataset.surface = isDarkWallpaper(wallpaper) ? "dark" : "light";
  }, [wallpaper]);

  const persist = useCallback((nextId: string, nextDim: number) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: nextId, dim: nextDim }));
    } catch {
      // Mode privé, quota plein : le choix reste actif pour la session.
    }
  }, []);

  const value = useMemo<WallpaperValue>(() => ({
    wallpaper,
    id,
    dim,
    customFiles,
    setWallpaper(nextId) {
      const next = resolveWallpaper(nextId);
      // Chaque fond a une opacité qui le rend lisible : un motif dense à 100 %
      // mange le texte. On l'applique au changement, l'utilisateur reste libre
      // de l'ajuster ensuite.
      const nextDim = next.suggestedDim ?? DEFAULT_DIM;
      setId(nextId);
      setDimState(nextDim);
      persist(nextId, nextDim);
    },
    setDim(nextDim) {
      const clamped = Math.min(1, Math.max(0, nextDim));
      setDimState(clamped);
      persist(id, clamped);
    },
    reset() {
      setId(DEFAULT_WALLPAPER_ID);
      setDimState(DEFAULT_DIM);
      persist(DEFAULT_WALLPAPER_ID, DEFAULT_DIM);
    },
  }), [customFiles, dim, id, persist, wallpaper]);

  return <WallpaperContext.Provider value={value}>{children}</WallpaperContext.Provider>;
}

export function useWallpaper() {
  const context = useContext(WallpaperContext);
  if (!context) throw new Error("useWallpaper doit être utilisé dans WallpaperProvider");
  return context;
}
