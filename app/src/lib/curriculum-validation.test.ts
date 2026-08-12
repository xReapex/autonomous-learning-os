import { describe, expect, it } from "vitest";

import raw from "../../content/curriculum.json";
import { validateCurriculumDocument } from "./curriculum-validation";

describe("validation runtime du curriculum", () => {
  it("accepte le curriculum livré", () => {
    const result = validateCurriculumDocument(raw);

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("refuse une source qui n'utilise pas HTTPS", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[0].lessons[0].source.url = "http://example.com/cours";

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("HTTPS");
  });

  it("refuse les champs inconnus", () => {
    const candidate = { ...structuredClone(raw), cheminArbitraire: "/etc/passwd" };

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("cheminArbitraire");
  });

  it("exige la version 1 du format", () => {
    const candidate = { ...structuredClone(raw), version: 2 };

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("version");
  });

  it("refuse les identifiants de leçon dupliqués", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[1].lessons[0].id = candidate.subjects[0].lessons[0].id;

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("dupliqué");
  });

  it("refuse une carte liée à une matière absente", () => {
    const candidate = structuredClone(raw);
    candidate.cards[0].subjectId = "matiere-inexistante";

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("subjectId");
  });

  it("refuse un lecteur vidéo hors youtube-nocookie", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[0].lessons[0].source.embedUrl = "https://evil.example/embed/video";

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("youtube-nocookie.com");
  });

  it("refuse un document qui ne respecte pas le schéma imbriqué", () => {
    const candidate = structuredClone(raw) as unknown as Record<string, unknown>;
    const subjects = candidate.subjects as Array<{ lessons: Array<Record<string, unknown>> }>;
    delete subjects[0].lessons[0].objective;

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("objective");
  });

  it("refuse une date impossible", () => {
    const candidate = { ...structuredClone(raw), generatedAt: "2026-02-30" };

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("date");
  });

  it("borne la longueur des chaînes métier", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[0].lessons[0].title = "x".repeat(301);

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("300 caractères");
  });

  it("refuse les noms hérités d'Object.prototype comme champs inconnus", () => {
    const candidate = structuredClone(raw) as unknown as Record<string, unknown>;
    Object.defineProperty(candidate, "constructor", {
      value: { arbitraryPath: "/etc/passwd" },
      enumerable: true,
    });
    const subjects = candidate.subjects as Array<Record<string, unknown>>;
    Object.defineProperty(subjects[0], "toString", { value: "champ injecté", enumerable: true });

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("constructor");
    expect(result.errors.join(" ")).toContain("toString");
  });

  it("refuse les durées numériques extrêmes", () => {
    const candidate = structuredClone(raw);
    const source = candidate.subjects[0].lessons[0].source;
    source.totalMinutes = 1e308;
    source.segmentStartSeconds = 1e308;

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toMatch(/totalMinutes|segmentStartSeconds/);
  });

  it("refuse une carte liée à la leçon d'une autre matière", () => {
    const candidate = structuredClone(raw);
    candidate.cards[0].subjectId = candidate.subjects[0].id;
    candidate.cards[0].lessonId = candidate.subjects[1].lessons[0].id;

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("n'appartient pas");
  });

  it("refuse embedUrl sur une source non vidéo", () => {
    const candidate = structuredClone(raw);
    const source = candidate.subjects[0].lessons[0].source;
    source.kind = "reading";

    const result = validateCurriculumDocument(candidate);

    expect(source.embedUrl).toBeTruthy();
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("non vidéo");
  });

  it("refuse une vidéo dans une autre langue que le curriculum", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[0].lessons[0].source.language = "en";

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("langue de la vidéo");
  });

  it("refuse une URL et un embed qui pointent vers deux vidéos différentes", () => {
    const candidate = structuredClone(raw);
    candidate.subjects[0].lessons[0].source.embedUrl =
      "https://www.youtube-nocookie.com/embed/NNnIGh9g6fA";

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("ne correspond pas");
  });

  it("exige la langue du curriculum", () => {
    const candidate = structuredClone(raw) as Partial<typeof raw>;
    delete candidate.language;

    const result = validateCurriculumDocument(candidate);

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("language");
  });
});
