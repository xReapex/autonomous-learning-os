import { describe, expect, it } from "vitest";

import {
  allLessons,
  curriculum,
  defaultCurriculumDocument,
  lessonById,
  normalizeCurriculumDocument,
  sourceAudit,
  subjectById,
  subjects,
} from "./curriculum";

describe("curriculum livré", () => {
  it("expose un sujet et un objectif exploitables", () => {
    expect(curriculum.subject.length).toBeGreaterThan(2);
    expect(curriculum.goal.length).toBeGreaterThan(20);
    expect(subjects.length).toBeGreaterThan(0);
  });

  it("accepte autant de matières que l'apprenant en veut", () => {
    // Il n'y a PAS de plafond. 3 à 5 est la recommandation (le validateur
    // l'affiche en avertissement), mais un curriculum à douze matières doit se
    // charger et s'afficher exactement comme un curriculum à une seule.
    expect(subjects.length).toBeGreaterThan(0);
    for (const subject of subjects) {
      expect(subject.lessons.length).toBeGreaterThan(0);
      // `lesson` est le raccourci vers la leçon courante : il doit exister pour
      // chaque matière, sinon le dashboard rendrait du vide.
      expect(subject.lesson).toBeDefined();
      expect(subject.lesson.id).toBe(subject.lessons[0].id);
    }
  });

  it("donne à chaque leçon une source gratuite, datée et argumentée", () => {
    for (const { lesson } of allLessons()) {
      expect(lesson.source.access).toBe("free");
      expect(lesson.source.url.startsWith("https://")).toBe(true);
      expect(lesson.source.why.length).toBeGreaterThan(20);
      expect(lesson.source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(lesson.keyTakeaways.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("rend chaque vidéo découpable et reprenable", () => {
    for (const { lesson } of allLessons()) {
      if (lesson.source.kind !== "video") continue;
      // Sans embed nocookie, ni la reprise ni le découpage ne fonctionnent.
      expect(lesson.source.embedUrl).toMatch(/^https:\/\/www\.youtube-nocookie\.com\/embed\//);
      expect(lesson.source.minutes).toBeGreaterThan(0);
      if (lesson.source.totalMinutes) {
        expect(lesson.source.minutes).toBeLessThanOrEqual(lesson.source.totalMinutes);
      }
    }
  });

  it("normalise segmentStartSeconds même quand le JSON l'omet", () => {
    for (const { lesson } of allLessons()) {
      expect(typeof lesson.source.segmentStartSeconds).toBe("number");
      expect(lesson.source.segmentStartSeconds).toBeGreaterThanOrEqual(0);
    }
  });

  it("n'attache jamais une carte à une matière ou une leçon inexistante", () => {
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const lessonIds = new Set(allLessons().map(({ lesson }) => lesson.id));

    for (const card of curriculum.cards) {
      if (card.subjectId) expect(subjectIds.has(card.subjectId)).toBe(true);
      if (card.lessonId) expect(lessonIds.has(card.lessonId)).toBe(true);
      expect(card.front.length).toBeGreaterThan(10);
      expect(card.back.length).toBeGreaterThan(10);
    }
  });
});

describe("accès au curriculum", () => {
  it("conserve la version et accepte un document injecté", () => {
    expect(defaultCurriculumDocument.version).toBe(1);
    const document = structuredClone(defaultCurriculumDocument);
    document.subjects[0].id = "matiere-runtime";
    const runtime = normalizeCurriculumDocument(document);

    expect(subjectById("matiere-runtime", runtime).id).toBe("matiere-runtime");
    expect(allLessons(runtime).length).toBeGreaterThan(0);
  });

  it("retombe sur la première matière pour un id inconnu", () => {
    expect(subjectById("n-existe-pas").id).toBe(subjects[0].id);
  });

  it("retrouve une leçon par son id, et rend undefined sinon", () => {
    const target = allLessons()[0].lesson.id;
    expect(lessonById(target)?.lesson.id).toBe(target);
    expect(lessonById("inconnu")).toBeUndefined();
  });

  it("compte les sources et les institutions distinctes", () => {
    const audit = sourceAudit();
    expect(audit.total).toBe(allLessons().length);
    expect(audit.providers).toBeGreaterThan(0);
    expect(audit.providers).toBeLessThanOrEqual(audit.total);
  });
});
