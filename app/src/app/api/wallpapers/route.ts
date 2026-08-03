import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = /\.(png|jpe?g|webp|avif|gif|svg)$/i;

/**
 * Liste les fonds déposés par l'utilisateur dans public/wallpapers/.
 * C'est ce qui permet d'ajouter ses propres images sans toucher au code : on
 * dépose un fichier, il apparaît dans la galerie.
 */
export async function GET() {
  try {
    const entries = await readdir(join(process.cwd(), "public", "wallpapers"), { withFileTypes: true });
    const files = entries
      .filter((entry) => entry.isFile() && ALLOWED.test(entry.name) && !entry.name.startsWith("."))
      .map((entry) => entry.name)
      .sort();
    return NextResponse.json({ files });
  } catch {
    // Dossier absent = aucun fond perso. Ce n'est pas une erreur.
    return NextResponse.json({ files: [] });
  }
}
