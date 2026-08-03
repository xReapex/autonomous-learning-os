// La galerie de fonds d'écran — reprise du système BizOS (WallpaperLayer +
// réglage d'opacité), mais avec des fonds ENTIÈREMENT PROCÉDURAUX.
//
// Pourquoi procéduraux : ce repo est public. Redistribuer des images — même
// générées — de personnes réelles ou d'œuvres protégées poserait un problème de
// droits à chaque personne qui clone. Ici tout est du SVG en data-URI écrit à la
// main : quelques kilo-octets, aucun asset binaire, aucune question juridique.
//
// L'utilisateur qui veut ses propres fonds dépose ses images dans
// public/wallpapers/ : elles apparaissent automatiquement dans la galerie via
// `customWallpaper()`.

export type WallpaperKind = "flat" | "pattern" | "image";

export type Wallpaper = {
  id: string;
  /** Libellé court, affiché en capitales espacées dans la galerie. */
  label: string;
  group: "Atelier" | "Grilles" | "Matières" | "Nuit" | "Perso";
  kind: WallpaperKind;
  /** Couleur de fond posée sous le motif. */
  color: string;
  /** Motif SVG en data-URI, répété. Absent pour les fonds plats. */
  pattern?: string;
  /** Taille de tuile du motif. */
  tile?: string;
  /** Opacité conseillée à l'application du fond (0 → 1). */
  suggestedDim?: number;
  /** Une ligne qui dit à qui ce fond s'adresse. */
  caption?: string;
};

/**
 * Opacité par défaut : pleine.
 *
 * En V9 le wallpaper occupe tout l'écran et reste visible autour des panneaux —
 * ce sont les cartes qui sont blanches et opaques, pas le fond qui est atténué.
 * Le curseur d'opacité reste offert pour les fonds très chargés.
 */
export const DEFAULT_DIM = 1;
export const DEFAULT_WALLPAPER_ID = "desk";

// Un motif SVG encodé pour un `url()` CSS. Les caractères qui cassent le parsing
// CSS (# et guillemets) sont échappés — le reste passe tel quel, ce qui garde
// les data-URI lisibles dans le devtools.
function svg(body: string, size = 120) {
  const doc = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${body}</svg>`;
  return `url("data:image/svg+xml,${doc.replace(/#/g, "%23").replace(/"/g, "'")}")`;
}

// La V9 est monochrome : le fond apporte le monde, les panneaux restent
// stricts. Aucun de ces motifs ne réintroduit d'accent coloré — les rares
// teintes sont désaturées et servent l'ambiance, jamais la signalétique.
const INK = "#111111";
const SOFT = "#4a4a4a";

export const WALLPAPERS: Wallpaper[] = [
  // ── Atelier ───────────────────────────────────────────────────────────────
  {
    id: "desk",
    label: "Atelier",
    group: "Atelier",
    kind: "flat",
    color: "#e8e8e6",
    suggestedDim: 1,
    caption: "Gris papier. Rien pour distraire.",
  },
  {
    id: "paper",
    label: "Papier",
    group: "Atelier",
    kind: "pattern",
    color: "#f1f0ed",
    tile: "26px 26px",
    pattern: svg(`<path d='M0 25.5 H26' stroke='${INK}' stroke-opacity='0.14' stroke-width='1'/>`, 26),
    suggestedDim: 1,
    caption: "Cahier ligné. Pour les sujets qui s'écrivent.",
  },
  {
    id: "linen",
    label: "Toile",
    group: "Atelier",
    kind: "pattern",
    color: "#e3e1dc",
    tile: "8px 8px",
    pattern: svg(`<path d='M0 0 H8 M0 4 H8' stroke='${INK}' stroke-opacity='0.07' stroke-width='1'/><path d='M0 0 V8 M4 0 V8' stroke='${INK}' stroke-opacity='0.05' stroke-width='1'/>`, 8),
    suggestedDim: 1,
  },

  // ── Grilles ───────────────────────────────────────────────────────────────
  {
    id: "grid",
    label: "Grille",
    group: "Grilles",
    kind: "pattern",
    color: "#ececeb",
    tile: "26px 26px",
    pattern: svg(`<path d='M26 0 H0 V26' fill='none' stroke='${INK}' stroke-opacity='0.16' stroke-width='1'/>`, 26),
    suggestedDim: 1,
    caption: "Sobre, structurante.",
  },
  {
    id: "blueprint",
    label: "Blueprint",
    group: "Grilles",
    kind: "pattern",
    color: "#20232a",
    tile: "40px 40px",
    pattern: svg(`<path d='M40 0 H0 V40' fill='none' stroke='#ffffff' stroke-opacity='0.3' stroke-width='1'/><path d='M8 0 V40 M16 0 V40 M24 0 V40 M32 0 V40 M0 8 H40 M0 16 H40 M0 24 H40 M0 32 H40' stroke='#ffffff' stroke-opacity='0.1' stroke-width='0.5'/>`, 40),
    suggestedDim: 1,
    caption: "Plan d'architecte. Ingénierie, systèmes.",
  },
  {
    id: "dots",
    label: "Points",
    group: "Grilles",
    kind: "pattern",
    color: "#efefee",
    tile: "20px 20px",
    pattern: svg(`<circle cx='2' cy='2' r='1.1' fill='${INK}' fill-opacity='0.22'/>`, 20),
    suggestedDim: 1,
  },

  // ── Matières ──────────────────────────────────────────────────────────────
  {
    id: "synapse",
    label: "Synapse",
    group: "Matières",
    kind: "pattern",
    color: "#eeeeec",
    tile: "80px 80px",
    pattern: svg(`<g fill='none' stroke='${SOFT}' stroke-opacity='0.3' stroke-width='1.1'><path d='M10 40 Q30 12 52 30 T78 22'/><path d='M4 66 Q28 54 44 70 T76 62'/></g><g fill='${SOFT}' fill-opacity='0.4'><circle cx='10' cy='40' r='2.2'/><circle cx='52' cy='30' r='1.9'/><circle cx='44' cy='70' r='1.9'/><circle cx='78' cy='22' r='1.6'/></g>`, 80),
    suggestedDim: 1,
    caption: "Cognition, apprentissage, sciences du cerveau.",
  },
  {
    id: "ledger",
    label: "Registre",
    group: "Matières",
    kind: "pattern",
    color: "#eaeae7",
    tile: "60px 30px",
    pattern: svg(`<path d='M0 29.5 H60' stroke='${INK}' stroke-opacity='0.13' stroke-width='1'/><path d='M40 0 V30' stroke='${INK}' stroke-opacity='0.22' stroke-width='1'/>`, 60),
    suggestedDim: 1,
    caption: "Finance, comptabilité, économie.",
  },
  {
    id: "orbit",
    label: "Orbite",
    group: "Matières",
    kind: "pattern",
    color: "#ededeb",
    tile: "100px 100px",
    pattern: svg(`<g fill='none' stroke='${SOFT}' stroke-opacity='0.26' stroke-width='1'><ellipse cx='50' cy='50' rx='44' ry='18'/><ellipse cx='50' cy='50' rx='18' ry='44'/><ellipse cx='50' cy='50' rx='34' ry='34'/></g><circle cx='50' cy='50' r='2.6' fill='${INK}' fill-opacity='0.55'/>`, 100),
    suggestedDim: 1,
    caption: "Astro, quantique, tout ce qui tourne.",
  },
  {
    id: "topography",
    label: "Relief",
    group: "Matières",
    kind: "pattern",
    color: "#e9eae7",
    tile: "120px 120px",
    pattern: svg(`<g fill='none' stroke='${SOFT}' stroke-opacity='0.28' stroke-width='1'><path d='M0 90 Q30 60 60 84 T120 70'/><path d='M0 72 Q34 44 62 66 T120 52'/><path d='M0 54 Q36 30 64 48 T120 34'/><path d='M0 36 Q38 16 66 30 T120 16'/></g>`, 120),
    suggestedDim: 1,
    caption: "Géographie, biologie, sciences du vivant.",
  },

  // ── Nuit ──────────────────────────────────────────────────────────────────
  {
    id: "midnight",
    label: "Minuit",
    group: "Nuit",
    kind: "flat",
    color: "#141414",
    suggestedDim: 1,
    caption: "Sessions tardives.",
  },
  {
    id: "starfield",
    label: "Ciel",
    group: "Nuit",
    kind: "pattern",
    color: "#121214",
    tile: "140px 140px",
    pattern: svg(`<g fill='#ffffff'><circle cx='18' cy='24' r='1.2' fill-opacity='0.8'/><circle cx='96' cy='12' r='0.9' fill-opacity='0.55'/><circle cx='60' cy='62' r='1.5' fill-opacity='0.85'/><circle cx='124' cy='88' r='1' fill-opacity='0.5'/><circle cx='34' cy='104' r='1.1' fill-opacity='0.65'/><circle cx='108' cy='46' r='0.8' fill-opacity='0.45'/><circle cx='76' cy='126' r='1' fill-opacity='0.6'/></g>`, 140),
    suggestedDim: 1,
  },
];

const BY_ID = new Map(WALLPAPERS.map((w) => [w.id, w]));

export function wallpaperById(id: string): Wallpaper | undefined {
  return BY_ID.get(id);
}

/**
 * Un fond déposé par l'utilisateur dans public/wallpapers/.
 * L'id EST le nom de fichier — c'est ce qui permet à la galerie d'afficher une
 * image locale sans que le catalogue la connaisse.
 */
export function customWallpaper(fileName: string): Wallpaper {
  return {
    id: fileName,
    label: fileName.replace(/\.[a-z0-9]+$/i, "").slice(0, 18),
    group: "Perso",
    kind: "image",
    // Le gris de l'espace de travail sous la photo, le temps qu'elle charge.
    color: "#e8e8e6",
    suggestedDim: 1,
  };
}

/** Résout un id en fond : catalogue d'abord, fichier perso ensuite. */
export function resolveWallpaper(id: string): Wallpaper {
  return wallpaperById(id) ?? (looksLikeFile(id) ? customWallpaper(id) : WALLPAPERS[0]);
}

export function looksLikeFile(id: string) {
  return /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(id);
}

export function wallpaperGroups() {
  const groups = new Map<Wallpaper["group"], Wallpaper[]>();
  for (const wallpaper of WALLPAPERS) {
    const list = groups.get(wallpaper.group) ?? [];
    list.push(wallpaper);
    groups.set(wallpaper.group, list);
  }
  return [...groups.entries()];
}

/**
 * Les styles CSS d'un fond, prêts à poser sur une div.
 * `dim` pilote l'opacité de la couche image/motif — la couleur de base reste
 * toujours opaque, sinon on verrait le blanc du document au travers.
 */
export function wallpaperStyles(wallpaper: Wallpaper, dim: number) {
  const base: Record<string, string> = { backgroundColor: wallpaper.color };

  if (wallpaper.kind === "image") {
    return {
      base,
      overlay: {
        backgroundImage: `url('/wallpapers/${wallpaper.id}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        opacity: String(dim),
      } as Record<string, string>,
    };
  }

  if (wallpaper.kind === "pattern" && wallpaper.pattern) {
    return {
      base,
      overlay: {
        backgroundImage: wallpaper.pattern,
        backgroundSize: wallpaper.tile ?? "24px 24px",
        backgroundRepeat: "repeat",
        opacity: String(dim),
      } as Record<string, string>,
    };
  }

  return { base, overlay: null };
}

/** Un fond sombre demande une encre claire — sinon l'interface devient illisible. */
export function isDarkWallpaper(wallpaper: Wallpaper) {
  const hex = wallpaper.color.replace("#", "");
  if (hex.length !== 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  // Luminance perçue (Rec. 601) — suffisant pour un choix binaire clair/sombre.
  return (0.299 * r + 0.587 * g + 0.114 * b) < 110;
}
