"use client";

// La galerie de fonds — reprise du picker BizOS : vignettes carrées à bordure
// nette, le fond actif rendu « enfoncé », plus un curseur d'opacité.

import { useWallpaper } from "./wallpaper-context";
import { customWallpaper, wallpaperGroups, wallpaperStyles, type Wallpaper } from "@/lib/wallpapers";

function Swatch({ wallpaper, active, onSelect }: {
  wallpaper: Wallpaper;
  active: boolean;
  onSelect: () => void;
}) {
  // La vignette montre le fond à pleine opacité : à 6 % on ne verrait rien et
  // tous les choix se ressembleraient.
  const { base, overlay } = wallpaperStyles(wallpaper, 1);

  return (
    <button type="button" className="bx-swatch" aria-pressed={active} onClick={onSelect} title={wallpaper.caption}>
      <span className="bx-swatch-preview">
        <span style={base} />
        {overlay ? <span style={overlay} /> : null}
      </span>
      <span className="bx-swatch-label">{wallpaper.label}</span>
    </button>
  );
}

export function WallpaperGallery() {
  const { id, dim, customFiles, setWallpaper, setDim, reset, wallpaper } = useWallpaper();

  return (
    <div className="bx-stack">
      <div className="bx-range">
        <label className="bx-label" htmlFor="wallpaper-dim">Opacité</label>
        <input
          id="wallpaper-dim"
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(dim * 100)}
          onChange={(event) => setDim(Number(event.target.value) / 100)}
        />
        <output htmlFor="wallpaper-dim">{Math.round(dim * 100)} %</output>
      </div>

      <p className="bx-muted">
        Actif : <strong>{wallpaper.label}</strong>
        {wallpaper.caption ? ` — ${wallpaper.caption}` : null}
      </p>

      {wallpaperGroups().map(([group, wallpapers]) => (
        <div className="bx-gallery-group" key={group}>
          <p>{group}</p>
          <div className="bx-gallery">
            {wallpapers.map((item) => (
              <Swatch key={item.id} wallpaper={item} active={item.id === id} onSelect={() => setWallpaper(item.id)} />
            ))}
          </div>
        </div>
      ))}

      <div className="bx-gallery-group">
        <p>Perso</p>
        {customFiles.length > 0 ? (
          <div className="bx-gallery">
            {customFiles.map((file) => (
              <Swatch
                key={file}
                wallpaper={customWallpaper(file)}
                active={file === id}
                onSelect={() => setWallpaper(file)}
              />
            ))}
          </div>
        ) : (
          <p className="bx-muted">
            Dépose tes images dans <code>public/wallpapers/</code> — elles apparaissent ici au rechargement.
          </p>
        )}
      </div>

      <button type="button" className="bx-btn bx-btn-ghost" onClick={reset}>
        Revenir au bureau par défaut
      </button>
    </div>
  );
}
