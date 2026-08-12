const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

function primaryLanguage(value) {
  return typeof value === "string" ? value.trim().toLowerCase().split(/[-_]/, 1)[0] : "";
}

function youtubeVideoId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || !YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return "";
    if (url.hostname.toLowerCase() === "youtu.be") return url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (url.pathname === "/watch") return url.searchParams.get("v") ?? "";
    const match = /^\/(?:shorts|live)\/([^/?#]+)/.exec(url.pathname);
    return match?.[1] ?? "";
  } catch {
    return "";
  }
}

function youtubeEmbedId(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hostname.toLowerCase() !== "www.youtube-nocookie.com") return "";
    return /^\/embed\/([^/?#]+)/.exec(url.pathname)?.[1] ?? "";
  } catch {
    return "";
  }
}

export function validateVideoSources(document) {
  const errors = [];
  const documentLanguage = primaryLanguage(document?.language);
  const lessons = (document?.subjects ?? []).flatMap((subject) => subject?.lessons ?? []);
  const sources = lessons.flatMap((lesson) => [lesson?.source, ...(lesson?.alternatives ?? [])]);

  for (const [index, source] of sources.entries()) {
    const path = `source[${index}]`;
    if (!source || typeof source !== "object") {
      errors.push(`${path}: source vidéo manquante`);
      continue;
    }
    if (source.kind !== "video") errors.push(`${path}.kind: seule une vidéo est autorisée`);

    const videoId = youtubeVideoId(source.url);
    if (!videoId) errors.push(`${path}.url: une URL de vidéo YouTube HTTPS est obligatoire`);

    const embedId = youtubeEmbedId(source.embedUrl);
    if (!embedId) errors.push(`${path}.embedUrl: un lecteur youtube-nocookie est obligatoire`);
    if (videoId && embedId && videoId !== embedId) errors.push(`${path}.embedUrl: la vidéo intégrée ne correspond pas à l’URL YouTube`);

    const sourceLanguage = primaryLanguage(source.language);
    if (!documentLanguage || !sourceLanguage || sourceLanguage !== documentLanguage) {
      errors.push(`${path}.language: la langue de la vidéo doit correspondre à celle du curriculum`);
    }
  }

  return errors;
}
