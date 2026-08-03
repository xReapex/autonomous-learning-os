import { describe, expect, it } from "vitest";

import {
  DEFAULT_WALLPAPER_ID,
  WALLPAPERS,
  customWallpaper,
  isDarkWallpaper,
  looksLikeFile,
  resolveWallpaper,
  wallpaperById,
  wallpaperStyles,
} from "./wallpapers";

describe("catalogue", () => {
  it("ne contient aucun identifiant en double", () => {
    const ids = WALLPAPERS.map((wallpaper) => wallpaper.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("expose le fond par défaut", () => {
    expect(wallpaperById(DEFAULT_WALLPAPER_ID)).toBeDefined();
  });

  it("n'embarque aucun asset binaire — tout est procédural", () => {
    // C'est ce qui rend le dépôt publiable sans question de droits.
    for (const wallpaper of WALLPAPERS) {
      expect(wallpaper.kind).not.toBe("image");
      if (wallpaper.pattern) expect(wallpaper.pattern.startsWith("url(\"data:image/svg+xml,")).toBe(true);
    }
  });

  it("propose une opacité lisible pour chaque motif", () => {
    for (const wallpaper of WALLPAPERS) {
      if (wallpaper.suggestedDim === undefined) continue;
      expect(wallpaper.suggestedDim).toBeGreaterThan(0);
      expect(wallpaper.suggestedDim).toBeLessThanOrEqual(1);
    }
  });
});

describe("resolveWallpaper", () => {
  it("reconnaît un fichier déposé par l'utilisateur", () => {
    const resolved = resolveWallpaper("montagne.webp");
    expect(resolved.kind).toBe("image");
    expect(resolved.group).toBe("Perso");
  });

  it("retombe sur le premier fond pour un id inconnu qui n'est pas un fichier", () => {
    expect(resolveWallpaper("n-importe-quoi").id).toBe(WALLPAPERS[0].id);
  });
});

describe("looksLikeFile", () => {
  it("n'accepte que des extensions d'image", () => {
    expect(looksLikeFile("fond.png")).toBe(true);
    expect(looksLikeFile("fond.JPEG")).toBe(true);
    expect(looksLikeFile("fond.txt")).toBe(false);
    expect(looksLikeFile("grid")).toBe(false);
  });
});

describe("isDarkWallpaper", () => {
  it("bascule l'encre sur les fonds sombres", () => {
    expect(isDarkWallpaper(wallpaperById("midnight")!)).toBe(true);
    expect(isDarkWallpaper(wallpaperById("desk")!)).toBe(false);
  });
});

describe("wallpaperStyles", () => {
  it("applique l'opacité au motif, jamais à la couleur de base", () => {
    const { base, overlay } = wallpaperStyles(wallpaperById("grid")!, 0.4);
    expect(base.opacity).toBeUndefined();
    expect(overlay?.opacity).toBe("0.4");
  });

  it("ne produit pas de calque pour un fond plat", () => {
    expect(wallpaperStyles(wallpaperById("desk")!, 1).overlay).toBeNull();
  });

  it("pointe un fond perso vers /wallpapers/", () => {
    const { overlay } = wallpaperStyles(customWallpaper("photo.webp"), 0.8);
    expect(overlay?.backgroundImage).toBe("url('/wallpapers/photo.webp')");
  });
});
