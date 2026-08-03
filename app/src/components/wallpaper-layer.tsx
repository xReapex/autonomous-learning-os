"use client";

// Le fond du bureau, peint derrière toutes les fenêtres.
//
// Trois couches : la couleur pleine, le motif ou l'image à l'opacité choisie,
// puis le grain papier — repris tel quel du bureau BizOS pour que l'ensemble
// reste cohérent quel que soit le fond.

import { useWallpaper } from "./wallpaper-context";
import { wallpaperStyles } from "@/lib/wallpapers";

export function WallpaperLayer() {
  const { wallpaper, dim } = useWallpaper();
  const { base, overlay } = wallpaperStyles(wallpaper, dim);

  return (
    <div className="bx-wallpaper" aria-hidden="true">
      <div style={base} />
      {overlay ? <div style={overlay} /> : null}
      <div className="bx-wallpaper-grain" />
    </div>
  );
}
