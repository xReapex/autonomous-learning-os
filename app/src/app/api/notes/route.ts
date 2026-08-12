import { NextResponse } from "next/server";

import { loadActiveCurriculum } from "@/lib/curriculum-store";
import { getStorage } from "@/lib/storage";

export const dynamic = "force-dynamic";

/** Une note de 200 ko n'est plus une note. La borne protège le stockage. */
const MAX_NOTE_LENGTH = 40_000;

export async function GET() {
  return NextResponse.json(await getStorage().listNotes());
}

export async function PUT(request: Request) {
  const subjects = (await loadActiveCurriculum()).document.subjects;
  let body: { subjectId?: unknown; body?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Corps de requête illisible." }, { status: 400 });
  }

  const subjectId = typeof body.subjectId === "string" ? body.subjectId : "";
  const text = typeof body.body === "string" ? body.body : "";

  if (!subjects.some((subject) => subject.id === subjectId)) {
    return NextResponse.json({ error: "Matière inconnue dans ce curriculum." }, { status: 404 });
  }
  if (text.length > MAX_NOTE_LENGTH) {
    return NextResponse.json({ error: `Note trop longue (max ${MAX_NOTE_LENGTH} caractères).` }, { status: 413 });
  }

  await getStorage().saveNote(subjectId, text);
  return NextResponse.json({ subjectId, saved: true });
}
