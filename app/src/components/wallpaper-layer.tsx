"use client";

// Le fond de l'espace de travail.
//
// En V9 il occupe tout l'écran et reste visible autour des panneaux : aucune
// atténuation par défaut, aucun grain. Les cartes blanches opaques assurent
// seules la lisibilité du contenu.

import { useWallpaper } from "./wallpaper-context";
import { wallpaperStyles } from "@/lib/wallpapers";

export function WallpaperLayer() {
  const { wallpaper, dim } = useWallpaper();
  const { base, overlay } = wallpaperStyles(wallpaper, dim);

  return (
    <div className="bx-wallpaper" aria-hidden="true">
      <div style={base} />
      {overlay ? <div style={overlay} /> : null}
    </div>
  );
}
