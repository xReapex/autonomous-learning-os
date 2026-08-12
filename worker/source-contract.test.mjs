import test from "node:test";
import assert from "node:assert/strict";

import { validateVideoSources } from "./source-contract.mjs";

const source = {
  title: "Comprendre la dérivée",
  provider: "Maths et Tiques",
  kind: "video",
  language: "fr",
  url: "https://www.youtube.com/watch?v=abcdefghijk",
  embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
  totalMinutes: 12,
  minutes: 8,
  why: "Une explication visuelle adaptée au niveau demandé.",
  access: "free",
  accessNote: "Accessible gratuitement sur YouTube.",
  verifiedAt: "2026-08-10",
  segmentLabel: "Dérivée et pente locale",
};

function documentWith(candidate = source, language = "fr") {
  return {
    version: 1,
    language,
    subjects: [{ id: "maths", lessons: [{ id: "derivee", source: candidate, alternatives: [] }] }],
  };
}

test("accepte uniquement une vidéo YouTube dans la langue du curriculum", () => {
  assert.deepEqual(validateVideoSources(documentWith()), []);
});

test("refuse une ressource de lecture", () => {
  assert.match(validateVideoSources(documentWith({ ...source, kind: "reading" })).join(" "), /vid[eé]o/i);
});

test("refuse une vidéo qui ne vient pas de YouTube", () => {
  assert.match(validateVideoSources(documentWith({ ...source, url: "https://vimeo.com/123" })).join(" "), /youtube/i);
});

test("refuse une vidéo dans une autre langue", () => {
  assert.match(validateVideoSources(documentWith({ ...source, language: "en" })).join(" "), /langue|language/i);
});

test("refuse une vidéo sans lecteur youtube-nocookie", () => {
  const { embedUrl: _removed, ...withoutEmbed } = source;
  assert.match(validateVideoSources(documentWith(withoutEmbed)).join(" "), /embed|lecteur/i);
});
