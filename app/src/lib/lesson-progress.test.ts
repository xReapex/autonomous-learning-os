import { describe, expect, it } from "vitest";

import type { LessonSource } from "./curriculum";
import {
  getResumableSegment,
  isSegmentComplete,
  normalizeLessonProgress,
  parseYouTubeProgressMessage,
  trackedPlayerUrl,
} from "./lesson-progress";

const source: LessonSource = {
  title: "Cours de test",
  provider: "Institution / Auteur",
  kind: "video",
  url: "https://example.org/cours",
  embedUrl: "https://www.youtube-nocookie.com/embed/abc123",
  totalMinutes: 60,
  minutes: 10,
  why: "Parce que c'est le cas de test.",
  access: "free",
  accessNote: "Accès libre.",
  verifiedAt: "2026-08-03",
  segmentLabel: "Segment de test",
  segmentStartSeconds: 300,
};

describe("normalizeLessonProgress", () => {
  it("rend une progression vide sur une entrée absente ou corrompue", () => {
    for (const input of [null, undefined, "cassé", 42, { positionSeconds: -5 }]) {
      const progress = normalizeLessonProgress(input, "l1", source.url);
      expect(progress.positionSeconds).toBe(0);
      expect(progress.completed).toBe(false);
      expect(progress.lessonId).toBe("l1");
    }
  });

  it("n'accepte `completed` que sur un vrai booléen", () => {
    expect(normalizeLessonProgress({ completed: "true" }, "l1", source.url).completed).toBe(false);
    expect(normalizeLessonProgress({ completed: true }, "l1", source.url).completed).toBe(true);
  });
});

describe("getResumableSegment", () => {
  it("repart du début configuré quand rien n'a été vu", () => {
    const segment = getResumableSegment(source, 10, 0);
    expect(segment.startSeconds).toBe(300);
    expect(segment.endSeconds).toBe(900);
  });

  it("reprend à la position sauvegardée quand elle est plus avancée", () => {
    const segment = getResumableSegment(source, 10, 720);
    expect(segment.startSeconds).toBe(720);
    expect(segment.endSeconds).toBe(1320);
  });

  it("ne dépasse jamais la fin de la ressource", () => {
    const segment = getResumableSegment(source, 30, 3500);
    expect(segment.endSeconds).toBe(3600);
  });

  it("raccourcit la capsule quand le bloc disponible est plus court", () => {
    expect(getResumableSegment(source, 4, 0).endSeconds).toBe(300 + 4 * 60);
  });
});

describe("isSegmentComplete", () => {
  it("tolère les cinq dernières secondes", () => {
    expect(isSegmentComplete(896, 900)).toBe(true);
    expect(isSegmentComplete(880, 900)).toBe(false);
  });
});

describe("parseYouTubeProgressMessage", () => {
  const payload = JSON.stringify({
    event: "infoDelivery",
    info: { currentTime: 123.7, duration: 3600, playerState: 1 },
  });

  it("accepte les deux origines YouTube légitimes", () => {
    for (const origin of ["https://www.youtube.com", "https://www.youtube-nocookie.com"]) {
      expect(parseYouTubeProgressMessage(origin, payload)?.currentTime).toBe(123);
    }
  });

  it("rejette toute autre origine", () => {
    // Sans ce contrôle, n'importe quelle page ouverte pourrait falsifier la
    // progression de l'apprenant.
    for (const origin of ["https://evil.example", "https://youtube.com.attacker.net", "null"]) {
      expect(parseYouTubeProgressMessage(origin, payload)).toBeNull();
    }
  });

  it("ignore les messages qui ne portent pas de progression", () => {
    expect(parseYouTubeProgressMessage("https://www.youtube.com", "pas du json")).toBeNull();
    expect(parseYouTubeProgressMessage("https://www.youtube.com", JSON.stringify({ event: "autre" }))).toBeNull();
    expect(parseYouTubeProgressMessage("https://www.youtube.com", JSON.stringify({ event: "infoDelivery", info: {} }))).toBeNull();
  });
});

describe("trackedPlayerUrl", () => {
  it("active l'API JS et borne le segment", () => {
    const url = trackedPlayerUrl(source, 300, 900);
    expect(url).toContain("start=300");
    expect(url).toContain("end=900");
    expect(url).toContain("enablejsapi=1");
    expect(url.startsWith("https://www.youtube-nocookie.com/embed/")).toBe(true);
  });

  it("rend une chaîne vide sans embed — le lecteur ne doit pas s'afficher", () => {
    expect(trackedPlayerUrl({ ...source, embedUrl: undefined }, 0, 60)).toBe("");
  });
});
